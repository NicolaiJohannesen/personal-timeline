# Comprehensive Code Review: Personal Timeline

**Date:** 2026-02-12
**Codebase:** Next.js 16 / React 19 / TypeScript / IndexedDB
**Scope:** Full codebase (~19,000 LOC source, ~17,000 LOC tests, 35 test files)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Assessment](#2-architecture-assessment)
3. [Security Findings](#3-security-findings)
4. [Data Layer Issues](#4-data-layer-issues)
5. [Import System Review](#5-import-system-review)
6. [UI & Component Review](#6-ui--component-review)
7. [Performance Analysis](#7-performance-analysis)
8. [Accessibility Audit](#8-accessibility-audit)
9. [Test Suite Gap Analysis](#9-test-suite-gap-analysis)
10. [Improvement Opportunities](#10-improvement-opportunities)
11. [Proposed Test Plan](#11-proposed-test-plan)
12. [Prioritized Action Items](#12-prioritized-action-items)

---

## 1. Executive Summary

Personal Timeline is a well-structured local-first life-tracking application with solid fundamentals. The codebase demonstrates good separation of concerns, comprehensive type definitions, and a mature test suite with 680+ tests. The import system is particularly strong, with 450+ tests covering multiple data formats.

However, this review identifies **43 specific issues** across security, data integrity, accessibility, and performance. The most critical findings are:

| Severity | Count | Key Issues |
|----------|-------|------------|
| **Critical** | 4 | ZIP bomb vulnerability, DB race conditions, API key exposure, silent data loss |
| **High** | 11 | Missing accessibility, no E2E tests, memory exhaustion, canvas inaccessible |
| **Medium** | 16 | Type safety gaps, inconsistent error handling, component coupling |
| **Low** | 12 | Code duplication, missing memoization, style inconsistencies |

**Overall assessment:** The application is functional and well-tested at the unit level, but needs hardening for production use—particularly around security, accessibility, and end-to-end reliability.

---

## 2. Architecture Assessment

### Strengths

- **Clean adapter pattern** for storage (`src/lib/db/types.ts`): The `DatabaseAdapter` interface with `IndexedDBAdapter` and `MemoryAdapter` implementations enables easy testing and future backend swaps.
- **App Router route groups**: The `(app)` group keeps the sidebar layout isolated from landing pages.
- **Local-first design**: All data stays in the browser via IndexedDB. No network dependency for core features.
- **Thin page components**: All 7 route pages are ~11 lines, delegating to rich client components.
- **Zod validation**: Input validation at boundaries using Zod schemas (`src/lib/db/validation.ts`, `src/lib/actions/goals.ts`).

### Concerns

#### 2.1 Monolithic Client Components

Several components exceed 600 lines and mix multiple concerns:

| Component | Lines | Concern Mix |
|-----------|-------|-------------|
| `ImportWizard.tsx` | 908 | Wizard state + file parsing + preview + confirmation |
| `TimelineCanvas.tsx` | 793 | Canvas rendering + event handling + mortality curve + zoom |
| `InsightsView.tsx` | 777 | Statistics + charts + heat map + comparisons + CSV export |
| `CoachView.tsx` | 656 | Chat UI + mock responses + context building + sidebar |
| `TimelineView.tsx` | 623 | Filters + search + layer toggles + export + canvas wrapper |

**Impact:** Difficult to test in isolation, poor code reuse, increased bundle size per route.

**Recommendation:** Extract sub-components. For example, `InsightsView` contains an inline `ActivityHeatMap` component (lines 678-774) that should be its own file. `CoachView` mixes a 71-line `generateMockResponse` function with UI logic.

#### 2.2 Server/Client Boundary Misalignment

The project declares a local-first architecture but uses Server Actions (`src/lib/actions/goals.ts`, `src/lib/actions/coach.ts`). Since all data lives in IndexedDB (browser-only), the Server Actions either:
- Don't actually execute server-side (they're called from client components and operate on client state), or
- Require unnecessary round-trips for operations that could be purely client-side.

The coach Server Action (`src/lib/actions/coach.ts`) is the one legitimate server-side operation (API key should not be in the browser), but the API key is actually passed from the client (see [Security Finding 3.1](#31-api-key-exposure-in-client-code)).

#### 2.3 No Global State Management

Each view component independently loads data from IndexedDB:
```
TimelineView → loads events
InsightsView → loads events, goals, profile
Sidebar → loads events, profile (polls every 5 seconds)
DreamboardView → loads goals
```

There's no shared state layer. If a user imports 500 events on the Import page, navigating to Timeline requires a full IndexedDB reload. The Sidebar polls on a 5-second interval (`src/components/client/Sidebar.tsx`) to stay updated—a workaround for the missing reactive data layer.

---

## 3. Security Findings

### 3.1 API Key Exposure in Client Code — CRITICAL

**File:** `src/components/client/CoachView.tsx:248-254`

```typescript
const result = await generateCoachResponse({
  message: input.trim(),
  apiKey: aiSettings.apiKey,  // API key sent from client
  model: aiSettings.model || 'claude-sonnet-4-20250514',
  context: contextSummary,
  conversationHistory,
});
```

The Anthropic API key is stored in `UserSettings.ai.apiKey` (IndexedDB) and passed from the client component to the Server Action. While the actual API call happens server-side, the key travels over the network and is accessible in browser DevTools (Network tab, IndexedDB inspector).

**Risk:** Any XSS vulnerability or browser extension can exfiltrate the key.

**Recommendation:** Store the API key in an HTTP-only cookie or server-side session. The Server Action should read the key from server-side storage, never from the client payload.

### 3.2 ZIP Bomb Vulnerability — CRITICAL

**File:** `src/lib/import/zip.ts:59-61`

```typescript
const arrayBuffer = await readFileAsArrayBuffer(zipFile);
const zip = await JSZip.loadAsync(arrayBuffer);
```

No protections against:
- **Compression ratio attacks**: A 10KB ZIP can decompress to 10GB+ (zip bomb)
- **Decompressed size limits**: JSZip loads the entire archive into memory
- **File count limits**: A ZIP with 100,000 tiny files causes iterator exhaustion

The existing 50MB file size limit (`src/lib/import/validation.ts:126-139`) only applies to the compressed size, not the decompressed output.

**Recommendation:**
- Track cumulative decompressed size during extraction
- Abort if decompressed/compressed ratio exceeds a threshold (e.g., 100:1)
- Limit maximum number of files extracted (e.g., 10,000)
- Add streaming decompression with size monitoring

### 3.3 No Prototype Pollution Prevention

**Files:** `src/lib/import/google.ts`, `src/lib/import/facebook.ts`, `src/lib/import/csv.ts`

All import parsers use `JSON.parse()` on user-supplied data without prototype pollution checks. A malicious JSON file with `__proto__` keys could pollute `Object.prototype`:

```json
{"__proto__": {"isAdmin": true}, "title": "Legitimate Event"}
```

**Recommendation:** Use a safe JSON parser or validate that parsed objects don't contain `__proto__`, `constructor`, or `prototype` keys.

### 3.4 Incomplete Input Sanitization

**File:** `src/lib/import/ical.ts:191-199`

```typescript
currentEvent.summary = truncateString(sanitizeString(unescapeICalValue(value)), 500);
```

The order is wrong: `sanitizeString()` runs on the escaped value, then `unescapeICalValue()` may reintroduce characters that sanitization was meant to remove.

**Correct order:** `truncateString(sanitizeString(unescapeICalValue(value)), 500)`

Wait—that IS the order shown. Let me re-examine: `sanitizeString(unescapeICalValue(value))` is actually correct if `sanitizeString` wraps `unescapeICalValue`. But the actual code passes `unescapeICalValue(value)` INTO `sanitizeString`, so the unescape happens first. This is correct. However, the broader concern remains: `sanitizeString()` only removes control characters—it doesn't prevent stored XSS if content is later rendered with `dangerouslySetInnerHTML` or similar.

### 3.5 Unsanitized File Paths in Metadata

**File:** `src/lib/import/facebook.ts:219`

```typescript
description: `Imported from Facebook: ${path}`,
```

ZIP entry paths are stored directly in event descriptions. While the app uses React (which escapes by default), any future raw HTML rendering path could be exploited.

---

## 4. Data Layer Issues

### 4.1 Database Initialization Race Condition — CRITICAL

**File:** `src/lib/db/index.ts:75-89`

```typescript
async function initializeAdapter(): Promise<void> {
  if (!isInitialized) {
    await currentAdapter.initialize();
    isInitialized = true;
  }
}

async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    await initializeAdapter();
  }
}
```

Multiple concurrent calls to `ensureInitialized()` can enter `initializeAdapter()` before `isInitialized` is set to `true`. This causes double-initialization, which may corrupt IndexedDB connections.

The IndexedDB adapter has partial mitigation via an `openPromise` pattern, but the Memory adapter has none, and the global `isInitialized` flag is not atomic.

**Fix:** Use a Promise-based singleton:
```typescript
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    if (!initPromise) {
      initPromise = currentAdapter.initialize().then(() => {
        isInitialized = true;
        initPromise = null;
      });
    }
    await initPromise;
  }
}
```

### 4.2 Silent Partial Import Failures — CRITICAL

**File:** `src/lib/db/adapters/indexeddb.ts:351-397`

The `addBatch()` method returns successfully even when individual records fail:

```typescript
transaction.oncomplete = () => {
  if (errors.length > 0) {
    console.warn(`Batch add completed with ${errors.length} errors:`, errors);
  }
  resolve(addedEvents);  // Returns partial result without error
};
```

A user importing 1,000 events may only get 800 stored, with 200 silently dropped. The only evidence is a `console.warn` that users never see.

**Impact:** Data loss during import with no user notification.

**Recommendation:** Return a structured result: `{ added: TimelineEvent[], failed: { event: TimelineEvent, error: string }[] }`.

### 4.3 Unsafe `any` in AssessmentResult

**File:** `src/types/index.ts:148-149`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
scores: Record<string, any>;
```

This is the only `any` in the entire type system. All downstream consumers (coach context builder, assessment views, export utilities) lose type safety.

**Recommendation:** Create a discriminated union:
```typescript
type BigFiveScores = {
  openness: number; conscientiousness: number;
  extraversion: number; agreeableness: number; neuroticism: number;
};
type MBTIScores = { type: string; dimensions: Record<string, number> };
// ... per assessment type

type AssessmentScores =
  | { assessmentType: 'personality_big5'; scores: BigFiveScores }
  | { assessmentType: 'personality_mbti'; scores: MBTIScores }
  // etc.
```

### 4.4 Inconsistent `userId` Handling

| Type | `userId` | Required? |
|------|----------|-----------|
| `TimelineEvent` | `userId?: string` | Optional |
| `Goal` | `userId: string` | Required |
| `AssessmentResult` | `userId?: string` | Optional |
| `UserProfile` | `id: string` | Always `'default-user'` |

Server actions hardcode `'default-user'` (`src/lib/actions/goals.ts:121`), but the Zod schema requires a non-empty string. The IndexedDB adapter uses `DEFAULT_USER_ID` constant while the Memory adapter uses a hardcoded `'default-user'` string separately.

**Recommendation:** Either make `userId` consistently optional across all types (since this is single-user), or define a shared `DEFAULT_USER_ID` constant used everywhere.

### 4.5 No Soft Delete / Audit Trail

All delete operations are permanent and immediate:
```typescript
delete(id: string): Promise<void>;  // src/lib/db/types.ts:22
```

No `deletedAt` timestamp, no recovery mechanism, no undo. A user can permanently lose years of imported data with a single click.

### 4.6 IndexedDB `updateOrder` Transaction Safety

**File:** `src/lib/db/adapters/indexeddb.ts:426-451`

```typescript
for (const { id, order } of goals) {
  const getRequest = store.get(id);
  getRequest.onsuccess = () => {
    const goal = getRequest.result as Goal | undefined;
    if (goal) {
      goal.order = order;
      goal.updatedAt = new Date();
      store.put(goal);  // Fire-and-forget within callback
    }
  };
}
```

The `store.put()` inside `onsuccess` callbacks is not awaited. If the transaction completes before all `put()` operations finish, order changes are lost silently. In practice, IndexedDB keeps the transaction alive while there are pending requests, but this pattern is fragile and hard to reason about.

### 4.7 No Multi-Tab Conflict Detection

If the app is open in multiple tabs, each tab writes to IndexedDB independently with no optimistic locking or version checking. Last write wins without conflict detection.

### 4.8 `getByDateRange` Scans All Events

**File:** `src/lib/db/adapters/indexeddb.ts:340-348`

```typescript
async getByDateRange(startDate: Date, endDate: Date): Promise<TimelineEvent[]> {
  const allEvents = await this.getAll();
  return allEvents.filter((event) => {
    const eventTime = new Date(event.startDate).getTime();
    return eventTime >= startTime && eventTime <= endTime;
  });
}
```

This loads ALL events into memory, then filters client-side. With thousands of events, this becomes slow and memory-intensive. IndexedDB supports cursor-based range queries that should be used instead.

---

## 5. Import System Review

### Strengths

The import system is the best-tested part of the codebase (450+ tests). It handles:
- 5 data formats (Facebook, Google, LinkedIn, CSV, iCal) with ZIP support
- Content-based format detection (Google Keep)
- Date normalization across 10+ formats
- Automatic layer classification
- GPS coordinate validation
- Progressive parsing with error collection

### 5.1 Missing Decompression Limits

**File:** `src/lib/import/zip.ts`

Current limits per parser:

| Component | Limit | Config |
|-----------|-------|--------|
| File upload size | 50 MB | `validation.ts:126` |
| Google Locations | 100,000 entries | `google.ts:22` |
| Google Calendar | 50,000 entries | `google.ts:23` |
| iCal Events | 50,000 entries | `ical.ts:13` |
| CSV Rows | 100,000 rows | `csv.ts:27` |

**Missing:**
- Decompressed ZIP total size limit
- Cumulative memory tracking across multiple files
- ZIP file count limit
- Compression ratio monitoring

### 5.2 Code Duplication Across Parsers

The same patterns are repeated in every parser:

1. **File size validation** (5 places): `facebook.ts:255`, `linkedin.ts:37`, `google.ts:133`, `csv.ts:42`, `ical.ts:46`
2. **ZIP extraction setup** (3 places): `facebook.ts:268`, `linkedin.ts:47`, `google.ts:143`
3. **Stats calculation** (all parsers):
   ```typescript
   const eventsByLayer: Partial<Record<DataLayer, number>> = {};
   for (const event of events) {
     eventsByLayer[event.layer] = (eventsByLayer[event.layer] || 0) + 1;
   }
   ```

**Recommendation:** Extract shared utilities: `validateFileSize()`, `extractAndFilter()`, `calculateImportStats()`.

### 5.3 Validation vs Import Data Flow Gap

**File:** `src/lib/db/validation.ts:151-162` and `src/lib/db/adapters/indexeddb.ts:159-195`

The validation module collects errors and produces a report, but the import function proceeds with unvalidated data:

```typescript
// Validation generates errors...
errors.push({ field: 'events', message: `Invalid event at index ${i}` });

// ...but importData() ignores them:
if (data.events && data.events.length > 0) {
  await this.timelineEvents.addBatch(data.events);  // All events, including invalid ones
}
```

### 5.4 sourceId Collision Risk

**File:** `src/lib/import/csv.ts:243`

```typescript
sourceId: `csv_${index}_${startDate.getTime()}`,
```

Two CSV rows at the same index with the same timestamp produce identical sourceIds. Since `addBatch` uses `put()` (upsert), the second row silently overwrites the first.

---

## 6. UI & Component Review

### 6.1 Modal Accessibility

**Files:** `EventDetailPanel.tsx:146-336`, `DreamboardView.tsx:384-461`

Modal dialogs are missing:
- `role="dialog"` and `aria-modal="true"`
- Focus trap (Tab key escapes the modal)
- `aria-labelledby` connecting to the modal title
- Return-focus-to-trigger on close
- Escape key dismissal

### 6.2 Canvas Inaccessibility

**File:** `TimelineCanvas.tsx:644-790`

The canvas element is the primary data visualization but has:
- No `aria-label` or accessible name
- No keyboard navigation (zoom, pan, event selection)
- No screen reader alternative for displayed data
- No text fallback for visual content
- Click-only interaction (no touch gestures for mobile pan/zoom)

This violates WCAG 2.1 AA (1.1.1 Non-text Content, 2.1.1 Keyboard).

### 6.3 Color-Only Information Encoding

**Files:** `TimelineCanvas.tsx:17-25`, `InsightsView.tsx:712-717`, `DreamboardView.tsx:23-30`

Data layers, heat map intensity, and goal categories use color alone for identification. No patterns, icons, or text labels distinguish between categories for color-blind users.

**Violation:** WCAG 1.4.1 Use of Color.

### 6.4 Inconsistent Loading States

| Component | Loading Pattern | Style |
|-----------|----------------|-------|
| TimelineView | Skeleton with pulse | Dark cards |
| InsightsView | Skeleton grid | Animated bars |
| DreamboardView | Skeleton cards | Grid layout |
| CoachView | Fade-in text | "Loading..." |
| SettingsView | Text only | "Loading..." |

No shared loading/skeleton component. Each view implements its own.

### 6.5 Missing Error Recovery

**File:** `DreamboardView.tsx:123-132`

Delete operations have no error feedback:
```typescript
const handleDeleteGoal = async (id: string) => {
  await goals.delete(id);
  setGoalsList(prev => prev.filter(g => g.id !== id));
  // No try-catch, no error state
};
```

Similarly in `EventDetailPanel.tsx:78-109`, `SettingsView.tsx:93-121`.

### 6.6 Sidebar Mobile Behavior

**File:** `Sidebar.tsx:193-388`

The sidebar has a collapsed state (16px width) but no mobile breakpoint handling. On phones, the sidebar overlaps content or becomes unusable. No hamburger menu, swipe gesture, or responsive overlay.

---

## 7. Performance Analysis

### 7.1 Missing Memoization

| Component | Issue | Impact |
|-----------|-------|--------|
| `TimelineCanvas.tsx:305` | `drawEvents` callback recreated on `filteredEvents` change | Full canvas redraw |
| `InsightsView.tsx:461-486` | Layer distribution map not memoized | Recalculates on every render |
| `DreamboardView.tsx:340-353` | Goal cards in grid without `React.memo` | All cards re-render on any state change |
| `Sidebar.tsx:312-335` | Navigation items rendered inline | 6 items re-render on profile/count change |

### 7.2 Full-Table Scans in IndexedDB

`getByDateRange()` (`indexeddb.ts:340-348`) loads all events then filters. With 10,000+ events, this creates noticeable latency. `getActive()` goals (`indexeddb.ts:419-424`) similarly scans all goals.

IndexedDB supports IDBKeyRange for efficient index-based queries that should be used instead.

### 7.3 Canvas Full Redraw

**File:** `TimelineCanvas.tsx:405-426`

Every scale change triggers a complete canvas clear and redraw of all elements (mortality curve, grid lines, events, goals). No dirty-region tracking or layer caching.

For timelines with thousands of events, this causes visible frame drops during zoom/pan.

### 7.4 No Bundle Optimization

All 7 assessment components are imported together via `AssessmentsView.tsx`. Each is 400-750 lines. Dynamic imports (`React.lazy()`) could defer loading until the user actually opens an assessment.

### 7.5 Sidebar Polling

**File:** `Sidebar.tsx:95-151`

```typescript
const refreshInterval = setInterval(loadSidebarData, 5000);
```

The sidebar polls IndexedDB every 5 seconds for event counts and profile data. This is a workaround for the absence of a reactive data layer and wastes cycles when data hasn't changed.

---

## 8. Accessibility Audit

### WCAG 2.1 AA Compliance Issues

| Criterion | Issue | Components |
|-----------|-------|------------|
| **1.1.1 Non-text Content** | Canvas has no text alternative | TimelineCanvas |
| **1.3.1 Info & Relationships** | Modal structure not conveyed | EventDetailPanel, DreamboardView |
| **1.4.1 Use of Color** | Layer identification by color only | TimelineCanvas, InsightsView, DreamboardView |
| **2.1.1 Keyboard** | Canvas not keyboard-operable | TimelineCanvas |
| **2.1.2 No Keyboard Trap** | Modals lack focus trap | EventDetailPanel, GoalForm |
| **2.4.3 Focus Order** | No Tab order management for filters | TimelineView |
| **2.4.7 Focus Visible** | No custom focus indicators | All interactive elements |
| **3.2.2 On Input** | Search triggers filter immediately | TimelineView |
| **4.1.2 Name, Role, Value** | Buttons without accessible names | TimelineCanvas zoom controls |

### Missing ARIA Patterns

- **No live regions**: State changes (loading, errors, success messages) not announced
- **No landmark roles**: Page structure not conveyed to assistive technology
- **No skip navigation**: No way to bypass sidebar
- **Drag-and-drop**: Goal reordering has no keyboard alternative (`DreamboardView.tsx:150-202`)

---

## 9. Test Suite Gap Analysis

### Current Coverage

The test suite is substantial (680+ tests, 35 files) with excellent import parser coverage:

| Category | Tests | Files | Quality |
|----------|-------|-------|---------|
| Import Parsers | 450+ | 10 | Excellent |
| UI Components | 140+ | 17 | Good |
| Database | 66 | 2 | Good |
| Server Actions | 18+ | 2 | Adequate |
| Coach Context | 30+ | 1 | Good |
| Utilities | 27 | 1 | Good |
| Integration | ~30 | 1 | Limited |
| **E2E** | **0** | **0** | **Missing** |

### Critical Test Gaps

#### 9.1 No End-to-End Tests

Zero Playwright tests. No user journey verification:
- Import → Timeline → Insights flow
- Goal creation → Dreamboard → Coach context
- Settings change → UI update propagation
- Full assessment → Results stored → Coach awareness

#### 9.2 No Accessibility Tests

No axe-core, pa11y, or similar automated accessibility testing. The WCAG violations identified in Section 8 have no test coverage.

#### 9.3 No Performance/Load Tests

No tests verify behavior with large datasets:
- 10,000+ timeline events
- 1,000+ goals
- 50MB file imports
- Rapid successive imports

#### 9.4 No Security Tests

Missing test categories:
- ZIP bomb detection/prevention
- XSS payload sanitization
- Prototype pollution prevention
- API key handling
- Data export integrity

#### 9.5 Canvas Rendering Not Tested

`TimelineCanvas` is 793 lines of complex canvas drawing code with zero rendering verification. The test file mocks the canvas context but doesn't verify what's drawn.

#### 9.6 Missing Component Interaction Tests

- Keyboard navigation through filters
- Drag-and-drop goal reordering
- Multi-step wizard with back navigation
- Concurrent data operations (import while viewing)

#### 9.7 Missing Error Path Tests

- Network failures during coach API calls
- IndexedDB quota exceeded
- Corrupted database recovery
- Browser without IndexedDB support

### Test Quality Observations

**Strengths:**
- Factory functions for test data (`createTestEvent`, `createTestGoal`)
- Proper cleanup in `beforeEach`/`afterEach`
- Good edge case coverage for parsers (Unicode, empty inputs, boundary dates)

**Weaknesses:**
- Some tests check structure presence but not computed values
- Limited user interaction testing (click, not keyboard)
- `asyncCleanup.test.ts` has only 27 tests for 228 lines of utilities

---

## 10. Improvement Opportunities

### 10.1 Reactive Data Layer

Replace the current "load on mount + poll" pattern with a reactive approach:

**Option A: IndexedDB Observer Pattern**
```typescript
class DataStore {
  private listeners = new Map<string, Set<() => void>>();

  subscribe(store: string, callback: () => void) {
    // Notify on mutations
  }

  async mutate(store: string, operation: () => Promise<void>) {
    await operation();
    this.notify(store);
  }
}
```

**Option B: BroadcastChannel for Multi-Tab Sync**
```typescript
const channel = new BroadcastChannel('personal-timeline');
channel.onmessage = (event) => {
  if (event.data.type === 'data-changed') {
    // Reload affected queries
  }
};
```

**Impact:** Eliminates sidebar polling, ensures cross-view consistency, enables multi-tab awareness.

### 10.2 Component Decomposition

Split the largest components into focused sub-components:

```
InsightsView.tsx (777 lines) →
├── InsightsView.tsx (shell + layout)
├── LifeProgressCard.tsx
├── EventDistributionChart.tsx
├── EventTimelineChart.tsx
├── ActivityHeatMap.tsx
├── GlobalComparisons.tsx
└── InsightsExport.tsx

CoachView.tsx (656 lines) →
├── CoachView.tsx (shell)
├── ChatMessageList.tsx
├── ChatInput.tsx
├── CoachSidebar.tsx
├── SuggestedPrompts.tsx
└── mockResponses.ts (utility)
```

### 10.3 Shared UI Component Library

Extract repeated patterns into shared components:

| Component | Used In | Current State |
|-----------|---------|---------------|
| `<Modal>` | EventDetail, GoalForm, DreamboardDelete, Settings | Each re-implements |
| `<Skeleton>` | Timeline, Insights, Dreamboard, Coach | 4 different implementations |
| `<EmptyState>` | Timeline, Dreamboard, Coach | Inline in each view |
| `<ConfirmDialog>` | DreamboardDelete, SettingsDelete | Duplicated |
| `<ErrorAlert>` | Multiple views | Inconsistent patterns |

### 10.4 Undo/Redo System

Implement an undo stack for destructive operations:

```typescript
interface UndoAction {
  type: 'delete_event' | 'delete_goal' | 'update_event' | ...;
  undo: () => Promise<void>;
  description: string;
  expiresAt: number; // Auto-expire after 30s
}
```

Show a toast: "Event deleted. [Undo]" that persists for 30 seconds.

### 10.5 Import Progress & Resume

For large imports, add:
- Progress bar with events-processed/total count
- Ability to cancel mid-import
- Resume capability for interrupted imports (track last-processed offset)
- Detailed import report: "Imported 847 events, 23 skipped (duplicate), 5 failed (invalid date)"

### 10.6 Offline-First PWA

The app is already local-first. Adding a service worker and manifest would make it a full PWA:
- Works offline after first load
- Installable on mobile/desktop
- Background sync for future cloud backup feature

### 10.7 Data Migration System

No versioning system exists for the IndexedDB schema. When the schema changes (adding fields, renaming stores), there's no migration path. Implement:

```typescript
const MIGRATIONS = [
  { version: 1, migrate: (db) => { /* initial schema */ } },
  { version: 2, migrate: (db) => { /* add assessment store */ } },
  { version: 3, migrate: (db) => { /* add order field to goals */ } },
];
```

### 10.8 Canvas Accessibility Layer

Add an invisible DOM overlay that mirrors canvas content for screen readers:

```typescript
<div role="img" aria-label="Timeline visualization showing 847 events from 1990 to 2026">
  <div role="list" aria-label="Timeline events">
    {visibleEvents.map(event => (
      <div role="listitem" key={event.id} tabIndex={0}
           aria-label={`${event.title}, ${event.layer}, ${formatDate(event.startDate)}`}
           onKeyDown={handleEventKeyboard}>
      </div>
    ))}
  </div>
</div>
```

### 10.9 Structured Error Reporting

Replace `console.warn`/`console.error` with a structured error reporting system:

```typescript
interface AppError {
  code: string;           // 'IMPORT_PARTIAL_FAILURE'
  severity: 'info' | 'warning' | 'error';
  message: string;        // User-facing message
  details?: unknown;      // Debug details
  recoverable: boolean;
  suggestedAction?: string;
}
```

Surface errors through a notification system rather than console logging.

### 10.10 Typed Assessment Scores

Replace `Record<string, any>` with proper discriminated unions for each assessment type. This enables:
- Type-safe coach context building
- Compile-time validation of score rendering
- Autocomplete in IDEs
- Accurate JSON schema for export/import

---

## 11. Proposed Test Plan

### 11.1 E2E Tests (Playwright) — New

```
tests/e2e/
├── import-flow.spec.ts       # Upload → Preview → Confirm → Timeline shows events
├── timeline-navigation.spec.ts  # Zoom, pan, filter, search, click event
├── goal-lifecycle.spec.ts    # Create → Edit → Complete → Appears in Insights
├── coach-interaction.spec.ts # Send message → Receive response (mock API)
├── assessment-flow.spec.ts   # Complete assessment → Results stored → Coach aware
├── settings-management.spec.ts  # Edit profile → Sidebar updates
├── data-export-import.spec.ts   # Export JSON → Clear → Import → Verify
└── cross-page-data.spec.ts     # Import events → Navigate → Verify each page
```

### 11.2 Security Tests — New

```
tests/security/
├── zip-bomb.test.ts          # Verify decompression limits
├── xss-prevention.test.ts    # Malicious strings in all import formats
├── prototype-pollution.test.ts  # __proto__ in JSON/CSV imports
├── api-key-handling.test.ts  # Verify key not in client bundle/DOM
├── data-sanitization.test.ts # Control chars, script tags, event handlers
└── import-limits.test.ts     # File size, entry count, memory limits
```

### 11.3 Accessibility Tests — New

```
tests/accessibility/
├── axe-audit.test.ts         # Automated WCAG audit of each page
├── keyboard-navigation.test.ts  # Tab order, Enter/Space activation, Escape
├── screen-reader.test.ts     # ARIA labels, live regions, landmarks
├── color-contrast.test.ts    # Color-only information, contrast ratios
└── focus-management.test.ts  # Modal focus trap, return focus, skip nav
```

### 11.4 Performance Tests — New

```
tests/performance/
├── large-dataset.test.ts     # 10K events: load, filter, render timing
├── import-throughput.test.ts # Measure parse rates for each format
├── memory-usage.test.ts      # Track memory during large imports
├── canvas-frame-rate.test.ts # Measure draw time at different scales
└── indexeddb-query.test.ts   # Query performance with indexed vs scan
```

### 11.5 Missing Unit Tests — Fill Gaps

| File | Missing Tests | Priority |
|------|---------------|----------|
| `TimelineCanvas.tsx` | Draw output verification, event hit detection, zoom math | High |
| `pdfExport.ts` | PDF generation, content structure | Medium |
| `timelineExport.ts` | PNG export, JSON structure | Medium |
| `csvExport.ts` | CSV generation, escaping, headers | Medium |
| `InsightsView.tsx` | Heat map calculations, comparison data | Medium |
| `Sidebar.tsx` | Polling behavior, collapse persistence | Low |
| `ErrorBoundary.tsx` | Error catching, recovery flow | Low |

### 11.6 Integration Test Expansion

```
tests/integration/
├── data-flow.test.tsx        # (existing - expand)
├── import-to-timeline.test.tsx  # Import events → Timeline renders them
├── import-to-insights.test.tsx  # Import events → Charts update
├── goals-to-coach.test.tsx      # Goals → Coach context includes them
├── assessments-to-coach.test.tsx # Complete assessment → Coach references it
├── settings-propagation.test.tsx # Profile change → All views update
└── concurrent-operations.test.tsx # Parallel reads/writes to IndexedDB
```

### 11.7 Regression Test Suite

For each bug fix, add a test that:
1. Reproduces the original bug
2. Verifies the fix
3. Prevents regression

---

## 12. Prioritized Action Items

### Tier 1 — Critical (Blocks Production Readiness)

| # | Issue | Section | Effort |
|---|-------|---------|--------|
| 1 | Fix API key exposure — move to server-side storage | 3.1 | Medium |
| 2 | Add ZIP decompression size limits and ratio checks | 3.2, 5.1 | Small |
| 3 | Fix database initialization race condition | 4.1 | Small |
| 4 | Surface batch import failures to UI (not just console.warn) | 4.2 | Small |
| 5 | Add E2E test suite with Playwright | 9.1 | Large |
| 6 | Add modal accessibility (role, aria-modal, focus trap) | 6.1 | Medium |

### Tier 2 — High (Production Quality)

| # | Issue | Section | Effort |
|---|-------|---------|--------|
| 7 | Replace `Record<string, any>` with typed assessment scores | 4.3 | Medium |
| 8 | Add canvas accessibility overlay | 10.8 | Large |
| 9 | Add keyboard navigation for all interactive elements | 8 | Large |
| 10 | Add security test suite (ZIP bomb, XSS, prototype pollution) | 11.2 | Medium |
| 11 | Add `getByDateRange` IndexedDB cursor query | 4.8 | Small |
| 12 | Implement undo for delete operations | 10.4 | Medium |
| 13 | Add accessibility automated tests (axe-core) | 11.3 | Medium |
| 14 | Fix color-only information encoding | 6.3, 8 | Medium |
| 15 | Decompose 600+ line components | 10.2 | Large |

### Tier 3 — Medium (Maintainability & DX)

| # | Issue | Section | Effort |
|---|-------|---------|--------|
| 16 | Implement reactive data layer (replace polling) | 10.1 | Large |
| 17 | Standardize userId handling across types | 4.4 | Small |
| 18 | Deduplicate import parser shared logic | 5.2 | Medium |
| 19 | Create shared UI component library (Modal, Skeleton, etc.) | 10.3 | Large |
| 20 | Add import progress reporting and resume | 10.5 | Large |
| 21 | Add soft delete with audit timestamps | 4.5 | Medium |
| 22 | Add performance test suite | 11.4 | Medium |
| 23 | Fix validation-import data flow gap | 5.3 | Small |
| 24 | Add data migration/versioning system | 10.7 | Medium |
| 25 | Add structured error reporting system | 10.9 | Medium |

### Tier 4 — Low (Polish)

| # | Issue | Section | Effort |
|---|-------|---------|--------|
| 26 | Consistent loading state component | 6.4 | Small |
| 27 | Add memoization to component renders | 7.1 | Small |
| 28 | Dynamic import for assessment components | 7.4 | Small |
| 29 | Canvas incremental redraw / layer caching | 7.3 | Large |
| 30 | PWA service worker + manifest | 10.6 | Medium |
| 31 | Multi-tab conflict detection via BroadcastChannel | 4.7 | Medium |
| 32 | Fix sourceId collision in CSV import | 5.4 | Small |
| 33 | Sidebar mobile responsiveness | 6.6 | Medium |
| 34 | Add prototype pollution checks to JSON parsing | 3.3 | Small |

---

## Appendix: Files Reviewed

| Path | Lines | Category |
|------|-------|----------|
| `src/types/index.ts` | 164 | Types |
| `src/lib/db/index.ts` | 330 | Data layer |
| `src/lib/db/types.ts` | 110 | Data layer |
| `src/lib/db/validation.ts` | 260 | Data layer |
| `src/lib/db/adapters/indexeddb.ts` | 532 | Data layer |
| `src/lib/db/adapters/memory.ts` | 299 | Data layer |
| `src/lib/import/*.ts` | ~4,600 | Import system (13 files) |
| `src/lib/actions/goals.ts` | 226 | Server actions |
| `src/lib/actions/coach.ts` | ~150 | Server actions |
| `src/lib/coach/contextBuilder.ts` | 204 | Coach |
| `src/lib/utils/*.ts` | ~1,040 | Utilities (4 files) |
| `src/components/client/*.tsx` | ~10,500 | UI (19 files) |
| `src/components/server/AppShell.tsx` | ~50 | UI |
| `src/app/(app)/*.tsx` | ~77 | Pages (7 files) |
| `src/app/layout.tsx` | ~50 | Layout |
| `src/app/globals.css` | 338 | Styles |
| `tests/**/*.test.*` | ~17,000 | Tests (35 files) |
| Configuration files | ~180 | Config (7 files) |
