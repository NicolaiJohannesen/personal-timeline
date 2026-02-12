# Comprehensive Code Review — Personal Timeline

**Date:** 2026-02-12
**Scope:** Full codebase review (src/, tests/, configuration)
**Codebase:** ~18,400 lines source code, ~16,900 lines test code across 70+ files

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture & Project Structure](#2-architecture--project-structure)
3. [Critical Issues](#3-critical-issues)
4. [High-Priority Issues](#4-high-priority-issues)
5. [Medium-Priority Issues](#5-medium-priority-issues)
6. [Low-Priority Issues](#6-low-priority-issues)
7. [Type System & Data Layer](#7-type-system--data-layer)
8. [Component Review](#8-component-review)
9. [Import Parsers Review](#9-import-parsers-review)
10. [Database Layer Review](#10-database-layer-review)
11. [Test Suite Review](#11-test-suite-review)
12. [Accessibility Audit](#12-accessibility-audit)
13. [Performance Review](#13-performance-review)
14. [Security Review](#14-security-review)
15. [Design System & Styling](#15-design-system--styling)
16. [Summary & Recommendations](#16-summary--recommendations)

---

## 1. Executive Summary

### Overall Assessment: **Good with notable gaps**

The Personal Timeline codebase demonstrates solid engineering fundamentals — strong test coverage, clean separation of concerns, thoughtful validation, and a well-defined design system. However, several critical bugs and architectural gaps exist that would cause data loss or rendering failures in production.

### By the Numbers

| Metric | Value |
|--------|-------|
| Source files | ~40 |
| Test files | ~37 |
| Test-to-source ratio | 0.92x |
| Total test cases | 680+ |
| Critical issues | 5 |
| High-priority issues | 10 |
| Medium-priority issues | 18 |
| Low-priority issues | 12 |

### Top 5 Concerns

1. **Validation schema drift** — Zod schemas in `db/validation.ts` are out of sync with TypeScript interfaces, causing silent data loss on import/export
2. **Canvas CSS variable bug** — Canvas API cannot resolve CSS custom properties, causing rendering failure
3. **IndexedDB batch error handling** — Failed `put()` operations abort entire transaction; error handler doesn't prevent bubbling
4. **No error boundaries in routing** — No `error.tsx` or `loading.tsx` files in the App Router
5. **Accessibility gaps** — Canvas has no ARIA attributes, no skip-to-content link, no mobile responsive layout

---

## 2. Architecture & Project Structure

### Strengths

- **Clean separation**: Server components in `components/server/`, client in `components/client/`
- **Local-first design**: All data stays in IndexedDB, no backend dependency
- **Adapter pattern**: Database layer uses adapter pattern with IndexedDB and memory implementations
- **Route groups**: `(app)` route group properly encapsulates sidebar layout
- **Page-level metadata**: Each page exports its own Next.js Metadata for SEO

### Concerns

- **Monolithic client components**: Most View components are 500-900 lines. `ImportWizard.tsx` (909 lines) and `TimelineCanvas.tsx` (793 lines) would benefit from decomposition
- **Thin server layer**: Only 1 server component (`AppShell.tsx`, 19 lines). The app is essentially a full client-side SPA with Next.js as a shell
- **No `loading.tsx` or `error.tsx`**: None of the route segments implement Next.js error boundaries or loading skeletons
- **No `not-found.tsx`**: Missing 404 page
- **No providers directory used**: Context providers are absent; state is passed via props or loaded locally in each component
- **next.config.ts is empty**: No configuration at all — no image optimization, no headers, no redirects

---

## 3. Critical Issues

### C1: Validation Schema Drift — Data Loss on Import/Export

**File:** `src/lib/db/validation.ts`

The Zod validation schemas used for import/export validation have drifted significantly from the TypeScript interfaces in `src/types/index.ts`. When `parseAndValidateDatabaseExport()` calls `DatabaseExportSchema.parse(data)` (line 259), Zod strips any fields not in the schema. This silently drops valid data.

| Interface Field | In Schema? | Impact |
|----------------|------------|--------|
| `Goal.order` | Missing | Goal ordering lost on reimport |
| `UserProfile.settings` | Missing | All user settings lost |
| `UserProfile.lifeExpectancy` | Named `expectedLifespan` | Field rejected or renamed incorrectly |
| `UserProfile.country` | Named `location` | Field mismatch |
| `UserProfile.gender` | Missing | Gender data lost |
| `TimelineEvent.media` | Missing | Media attachments stripped |
| `GeoLocation.city` | Missing | City data stripped |
| `AssessmentResult.duration` | Missing | Duration data lost |

**Risk:** Any user who exports their data and reimports it will lose goal ordering, profile settings, media attachments, and other fields.

### C2: Canvas CSS Variable Bug

**File:** `src/components/client/TimelineCanvas.tsx:416`

```typescript
ctx.fillStyle = 'var(--color-bg-primary, #0d0d0d)';
```

The Canvas 2D API does **not** understand CSS custom properties. This line sets `fillStyle` to the literal string `"var(--color-bg-primary, #0d0d0d)"`, which is invalid. The Canvas API silently ignores invalid color values and keeps the previous fillStyle (defaults to `#000000`).

**Impact:** The background renders as pure black instead of the intended `oklch(0.05 0.01 280)`. Visually similar in this case, but the pattern is incorrect and would break with different theme colors.

### C3: Canvas Hardcoded Black Text on Dark Theme

**File:** `src/components/client/TimelineCanvas.tsx:290`

```typescript
ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
```

Event title text is rendered in near-black. On the dark-themed canvas background, this text is nearly invisible. The same hardcoding issue affects other text elements throughout the canvas drawing code.

### C4: IndexedDB Batch Add — Transaction Abort on Individual Failures

**File:** `src/lib/db/adapters/indexeddb.ts:377-388`

```typescript
request.onerror = () => {
  const errorMsg = request.error?.message || 'Unknown error';
  errors.push({ event, error: errorMsg });
  request.onerror = null; // This does NOT prevent transaction abort
};
```

When an individual `put()` request fails, the error bubbles up to the transaction. Per the IndexedDB spec, the error handler must call `event.preventDefault()` to prevent the transaction from aborting. The current code sets `request.onerror = null` after the handler fires, which has no effect. A single failed event will abort the entire batch import.

**Fix:** The error handler should be `(e) => { e.preventDefault(); ... }`.

### C5: AssessmentType Missing `health_metrics`

**File:** `src/types/index.ts:135-141`

```typescript
export type AssessmentType =
  | 'iq'
  | 'personality_big5'
  | 'personality_mbti'
  | 'risk_tolerance'
  | 'values'
  | 'fire_projection';
```

The `health_metrics` type is missing despite the Health Metrics Assessment being fully implemented. This could cause runtime type errors or silent data loss when storing health metrics results.

---

## 4. High-Priority Issues

### H1: No Error Boundaries in App Router

**Files:** `src/app/(app)/*`

No `error.tsx` files exist at any route level. If a client component throws during render, users see a blank page or the default Next.js error screen. The `ErrorBoundary.tsx` component exists but is not wired into the route tree.

### H2: No Loading Skeletons

**Files:** `src/app/(app)/*`

No `loading.tsx` files exist. Since all data fetching happens client-side in `useEffect`, users see a blank page until IndexedDB queries complete. This creates a poor perceived performance experience.

### H3: Fixed Sidebar Width — No Mobile Support

**File:** `src/components/server/AppShell.tsx`

```tsx
<main className="pl-64 transition-all duration-300">
```

The `pl-64` (256px) padding is hardcoded. On mobile viewports, the sidebar overlaps content. There is no hamburger menu, responsive breakpoint, or sidebar collapse mechanism for small screens.

### H4: Sidebar 5-Second Polling

**File:** `src/components/client/Sidebar.tsx:147`

```typescript
const interval = setInterval(loadData, 5000);
```

The sidebar polls IndexedDB every 5 seconds to refresh event counts, goal stats, and life progress. This is aggressive and cannot be disabled. On mobile devices, this wastes battery. Consider using a pub/sub pattern or only refreshing on navigation.

### H5: `window.location.href` Instead of Next.js Router

**File:** `src/components/client/TimelineView.tsx:528`

```typescript
window.location.href = `/dreamboard?goal=${goal.id}`;
```

This forces a full page reload instead of a client-side navigation. Should use `useRouter().push()` from `next/navigation`.

### H6: Unsafe Type Assertions Without Validation

**Multiple files:**

- `src/components/client/EventDetailPanel.tsx:277` — `e.target.value as DataLayer` without checking if value is valid
- `src/components/client/TimelineView.tsx:219` — `events as unknown as Array<Record<string, unknown>>`
- `src/components/client/InsightsView.tsx:185-186` — Gender cast to `'male' | 'female'` without validation

### H7: GPS Defaults to Null Island (0, 0)

**Files:** `src/lib/import/facebook.ts:594-596`, `src/lib/import/google.ts:342-343`

```typescript
latitude: coordinate?.latitude ?? 0,
longitude: coordinate?.longitude ?? 0,
```

When location data is incomplete, coordinates default to `(0, 0)` — a point in the Gulf of Guinea known as "Null Island." This creates misleading location markers. Should use `undefined` instead.

### H8: Race Condition in Database Adapter Initialization

**File:** `src/lib/db/index.ts:45-89`

Multiple concurrent calls to `getAdapter()` before initialization completes could create multiple adapter instances. The initialization flag is not atomic across async contexts.

### H9: Missing `parseInt` Radix

**File:** `src/lib/import/google.ts:312-314`

```typescript
typeof loc.timestampMs === 'string' ? parseInt(loc.timestampMs) : loc.timestampMs
```

Missing radix parameter in `parseInt()`. Should be `parseInt(loc.timestampMs, 10)`.

### H10: No Recursive ZIP Depth Limit

**File:** `src/lib/import/facebook.ts:281-310`

Nested ZIP files are processed recursively without a maximum depth. A maliciously crafted ZIP-within-ZIP chain could cause stack overflow.

---

## 5. Medium-Priority Issues

### M1: Unbounded Message History in Coach

**File:** `src/components/client/CoachView.tsx`

The `messages` array grows without limit. Long coaching sessions could consume significant memory.

### M2: Export Error Silently Swallowed

**File:** `src/components/client/TimelineView.tsx:236`

PDF/PNG export errors are caught and logged to console but never shown to the user.

### M3: Multiple useState Calls for Related State

**Files:** `TimelineView.tsx` (11+ states), `CoachView.tsx` (7+ states), `SettingsView.tsx` (8+ states)

Related state is split across many `useState` calls. This leads to intermediate render states where some values are updated and others aren't. Consider consolidating into `useReducer` or single state objects for related data.

### M4: Document Event Listeners in ImportWizard

**File:** `src/components/client/ImportWizard.tsx:202`

Drag-and-drop handlers add `document`-level event listeners. If the component rapidly unmounts and remounts, stale listeners could accumulate.

### M5: Naive Markdown Parsing in CoachView

**File:** `src/components/client/CoachView.tsx:391-408`

Bold text parsing uses `line.split(/(\*\*[^*]+\*\*)/)` which won't handle nested asterisks or escaped characters.

### M6: Inconsistent Error Reporting Across Parsers

Some import parsers (Facebook, Google) return detailed error arrays; others (LinkedIn) silently skip invalid records. Users get inconsistent feedback about import quality.

### M7: `crypto.randomUUID()` Without Fallback

**Files:** `src/lib/actions/goals.ts:122`, `src/components/client/GoalForm.tsx:68`

No fallback for environments where `crypto.randomUUID()` is unavailable.

### M8: `color-mix()` CSS Browser Compatibility

**File:** `src/components/client/EventDetailPanel.tsx:357`

```typescript
backgroundColor: `color-mix(in srgb, ${LAYER_COLORS[event.layer]} 20%, transparent)`
```

`color-mix()` has limited browser support (no Safari < 16.4, no older browsers).

### M9: Incomplete MIME Type Map

**File:** `src/lib/import/zip.ts:155-170`

Missing common formats: `.webp`, `.webm`, `.flac`, `.aac`, `.m4a`. These fall back to `application/octet-stream`.

### M10: Calendar Event Layer Detection Inconsistency

**File:** `src/lib/import/google.ts:436-467`

Only checks 4 layer categories (travel, work, health, education) in calendar events. Relationships, economics, and media keywords are not checked, unlike other parsers.

### M11: Layer Detection Word Boundary with Multi-Word Keywords

**File:** `src/lib/import/layerDetection.ts:192`

```typescript
new RegExp(`\\b${keyword.replace(...)}\\b`, 'i')
```

Keywords containing spaces break `\b` word boundary matching.

### M12: Date Parsing — Slash Format Ambiguity

**File:** `src/lib/import/dateParser.ts:113-140`

When `preferUSFormat = true`, a date like `13/01/2024` (valid EU format) returns `null` because month 13 is invalid. No automatic fallback to EU format is attempted.

### M13: EXIF GPS Returns 0 on Error

**File:** `src/lib/import/exif.ts:414`

`convertGpsCoordinate()` returns `0` on error instead of `null`, potentially creating false Null Island coordinates.

### M14: iCal Unescape Processing Order

**File:** `src/lib/import/ical.ts:322-326`

Unescaping processes `\\n` → `\n` before `\\` → `\`, which means `\\\n` (escaped backslash + newline) is incorrectly processed.

### M15: API Key Handling in Coach

**File:** `src/lib/actions/coach.ts:77`

API key is passed as a parameter through a Server Action. While this works, the key traverses the network boundary. Environment variables would be more secure.

### M16: Hardcoded AI Model Version

**File:** `src/lib/actions/coach.ts:11`

Default model hardcoded to `claude-sonnet-4-20250514`. No fallback if this model is deprecated.

### M17: iCal Recurring Events Not Expanded

**File:** `src/lib/import/ical.ts:213`

RRULE is stored but not expanded. A weekly recurring event creates 1 event instead of N occurrences.

### M18: UserProfile Validation Schema is `.optional()`

**File:** `src/lib/db/validation.ts:67`

The entire `UserProfileSchema` is wrapped in `.optional()`, meaning profile validation always passes even if the profile data is malformed — because `undefined` is valid.

---

## 6. Low-Priority Issues

| ID | File | Issue |
|----|------|-------|
| L1 | `TimelineCanvas.tsx:154` | Mortality curve recalculates every frame even when hidden |
| L2 | `InsightsView.tsx:403` | Data coverage score formula uses undocumented magic numbers |
| L3 | `DreamboardView.tsx:124` | Uses native `confirm()` dialog (blocking, unstyled) |
| L4 | `SettingsView.tsx:168` | `window.location.reload()` after data delete — could lose state in other tabs |
| L5 | `Sidebar.tsx:131-132` | Arrays filtered twice in sequence (could memoize) |
| L6 | `globals.css` | Webkit-only scrollbar styling (no Firefox support) |
| L7 | `globals.css` | No `@media print` rules despite having PDF export |
| L8 | `exif.ts:321` | `String.fromCharCode()` assumes ASCII; EXIF can contain UTF-8 |
| L9 | `validation.ts:10-11` | Date range 1900-2100 excludes valid historical dates |
| L10 | `layerDetection.ts:207` | Comment says "first layer wins" on tie, but highest priority wins |
| L11 | `zip.ts:86` | Empty files skipped silently without warning |
| L12 | `linkedin.ts:186` | Position sourceId uses only date — collisions possible for same-day positions |

---

## 7. Type System & Data Layer

### Types (`src/types/index.ts`) — 164 lines

**Strengths:**
- Clean union types for `DataLayer`, `EventSource`, `GoalCategory`, `GoalStatus`
- Proper optional vs required field distinction
- Consistent `Date` usage across entities

**Issues:**
- `AssessmentResult.scores` uses `Record<string, any>` with an eslint-disable comment (line 148-149). This is the only `any` in the type definitions
- `AssessmentType` is missing `'health_metrics'` (see C5)
- `UserProfile.userId` is absent — the profile uses `id` but events/goals use `userId`

### Database Types (`src/lib/db/types.ts`)

Clean repository pattern interfaces. Well-designed generic `BaseRepository` abstraction. No issues found.

### Import Types (`src/lib/import/types.ts`)

Properly defines `ImportResult`, `ParsedEvent`, and source-specific types. Good separation of import-specific types from core domain types.

---

## 8. Component Review

### Size Distribution

| Component | Lines | Complexity |
|-----------|-------|------------|
| ImportWizard.tsx | 909 | High — 4-step wizard, file handling, filtering |
| TimelineCanvas.tsx | 793 | High — Canvas API, zoom/pan, geometry |
| InsightsView.tsx | 777 | Medium — data aggregation, charts |
| CoachView.tsx | 657 | Medium — chat interface, API integration |
| TimelineView.tsx | 624 | Medium — filtering, export, stats |
| SettingsView.tsx | 624 | Medium — forms, settings management |
| DreamboardView.tsx | 590 | Medium — CRUD, drag-drop |
| EventDetailPanel.tsx | 455 | Low-Medium — modal, edit form |
| Sidebar.tsx | 390 | Low — navigation, stats |
| GoalForm.tsx | 334 | Low — form with milestones |
| Assessment Components (7) | ~350 avg | Low — questionnaire + scoring |

**Recommendation:** Components over 600 lines should be decomposed. `ImportWizard` could split into `SourceSelector`, `FileUploader`, `PreviewTable`, and `ConfirmStep`. `TimelineCanvas` could extract drawing logic into utility functions.

### Pattern Observations

- All view components follow the same pattern: `useEffect` → `Promise.all(db queries)` → `setIsLoading(false)` → render. This is consistent but should be extracted into a shared `useDbData` hook.
- Abort controller usage is inconsistent — `CoachView` and `ImportWizard` use `createAbortController`, but `TimelineView`, `InsightsView`, and `DreamboardView` don't.
- All components handle their own data loading. No shared data layer or context provider exists.

---

## 9. Import Parsers Review

### Coverage

| Parser | Lines | Test Cases | Quality |
|--------|-------|------------|---------|
| Facebook | 647 | 100+ | Excellent |
| Google | 581 | 80+ | Very Good |
| CSV | 491 | 60+ | Very Good |
| iCal | 403 | 40+ | Good |
| EXIF | 437 | 30+ | Good |
| LinkedIn | 287 | 40+ | Good |
| ZIP | 173 | 25+ | Good |
| Date Parser | 351 | 45+ | Good |
| Validation | 230 | 30+ | Very Good |

### Shared Strengths

- Comprehensive security limits (`MAX_FILE_SIZE`, `MAX_ROWS`, etc.)
- Consistent `ImportResult` return type with events, warnings, and errors
- Good defensive programming with optional chaining throughout
- Content-based detection (Google Keep) rather than relying on filenames

### Shared Concerns

- GPS coordinate defaults to `(0, 0)` across Facebook and Google parsers
- Inconsistent error verbosity — some parsers report per-record errors, others aggregate
- No shared constants file for limit values (each parser defines its own)
- Silent skipping of unparseable records without user notification

---

## 10. Database Layer Review

### Architecture

```
src/lib/db/
├── index.ts          # Facade with adapter pattern
├── types.ts          # Repository interfaces
├── validation.ts     # Zod schemas for import/export
└── adapters/
    ├── indexeddb.ts   # Production adapter
    └── memory.ts      # Test/SSR adapter
```

### Strengths

- Clean adapter pattern enables easy testing (memory adapter) and SSR compatibility
- Repository interfaces are well-typed and consistent
- Environment detection for IndexedDB availability
- Backward-compatible API via module-level proxies

### Issues Summary

| Issue | Severity | Details |
|-------|----------|---------|
| addBatch transaction abort | Critical | See C4 |
| Validation schema drift | Critical | See C1 |
| Adapter initialization race | High | See H8 |
| updateOrder sequencing | Medium | get/put operations not properly sequenced in IndexedDB transaction |
| No connection pooling | Low | Each operation creates a fresh transaction |

---

## 11. Test Suite Review

### Overall Rating: **8.5/10**

### Strengths

- **Excellent coverage density**: 680+ tests across 37 test files
- **Strong mock strategies**: `fake-indexeddb/auto` for DB, proper component mocking
- **Comprehensive edge cases**: 69+ tests specifically for error/edge scenarios
- **Well-organized**: Consistent `describe`/`it` hierarchy, factory helpers throughout
- **Integration tests**: Cross-component data flow tests with stateful mocks

### Coverage Gaps

**Components missing tests (3 of 19):**
- `ErrorBoundary.tsx` — no test file
- `MBTIAssessment.tsx` — no test file
- `HealthMetricsAssessment.tsx` — no test file

**Utilities missing tests (4):**
- `lib/utils/csvExport.ts`
- `lib/utils/pdfExport.ts`
- `lib/utils/timelineExport.ts`
- `lib/data/globalComparisons.ts`

### Test Infrastructure

- **Setup**: Clean `tests/setup.ts` with fake-indexeddb, Next.js navigation mocks, browser API mocks
- **Config**: Vitest with jsdom, React plugin, path aliasing, 4GB memory allocation
- **Helpers**: Consistent `createMockFile()`, `createTestEvent()`, `createTestGoal()` factories

### Areas for Improvement

- Canvas rendering tests are shallow (mock entire context) — consider visual regression testing
- Coach API integration only tests validation, not actual API calls (intentional but noted)
- No snapshot tests for any components
- No performance/benchmark tests

---

## 12. Accessibility Audit

**Target:** WCAG 2.1 AA (stated in CLAUDE.md)
**Current Status:** Significant gaps

| Category | Status | Details |
|----------|--------|---------|
| **Skip Navigation** | Missing | No skip-to-content link in AppShell |
| **ARIA Landmarks** | Partial | `<main>` used but Sidebar lacks `<nav>` role |
| **Canvas Accessibility** | Missing | No `role`, `aria-label`, or fallback content on `<canvas>` |
| **Focus Management** | Missing | Modals (EventDetailPanel, GoalForm) don't trap or return focus |
| **Form Labels** | Partial | Assessment radio buttons lack `<fieldset>` grouping |
| **Color Contrast** | Unverified | Amber on dark needs WCAG AA contrast ratio testing |
| **Keyboard Navigation** | Partial | `:focus-visible` defined in CSS but not tested on all interactive elements |
| **Screen Readers** | Missing | SVG icons in Sidebar have no `aria-label` or descriptive text |
| **Mobile Responsive** | Missing | Fixed 256px sidebar, no responsive breakpoints |
| **Reduced Motion** | Missing | No `prefers-reduced-motion` media query for animations |

---

## 13. Performance Review

### Positive

- `useMemo` used for expensive filter operations in `TimelineView` and `InsightsView`
- `useCallback` used for event handlers in `TimelineCanvas`
- Canvas uses DPI-aware rendering (`devicePixelRatio`)
- Pagination in ImportWizard (50 items/page) for large imports
- `Promise.all()` for parallel data fetching

### Concerns

| Issue | Impact | Location |
|-------|--------|----------|
| 5-second sidebar polling | Battery drain on mobile | `Sidebar.tsx:147` |
| Mortality curve recalculates every frame | CPU waste | `TimelineCanvas.tsx:154` |
| No lazy loading for route components | Larger initial bundle | All page.tsx files |
| No image optimization | N/A currently (no images) | — |
| Heat map maxCount recalculates unnecessarily | Minor CPU | `InsightsView.tsx:704` |
| Assessment `shuffleArray()` creates new array reference on every render | Re-renders | `BigFiveAssessment.tsx:81` |
| No virtual scrolling for long event lists | Memory for large datasets | `TimelineView.tsx` |

### Bundle Considerations

- `jszip` (~45KB gzipped) is imported at the module level in parsers; could be dynamically imported
- `@anthropic-ai/sdk` is a dependency but only used in server actions — verify tree-shaking
- `zod` v4.3.6 is used — relatively lightweight

---

## 14. Security Review

### Positive

- Local-first architecture eliminates most server-side attack vectors
- Input validation with Zod on all server actions
- File size limits enforced across all import parsers
- No SQL/NoSQL injection surface (IndexedDB with structured access)
- CSV parser has cell length limits and row/column caps

### Concerns

| Issue | Severity | Details |
|-------|----------|---------|
| API key in localStorage | Medium | AI coach API key stored in browser localStorage. Accessible to any JS on the page. `autoComplete="off"` missing on the input field |
| API key in Server Action parameter | Medium | Key traverses network in `coach.ts` Server Action. Environment variables would be more secure |
| No CSP headers | Low | `next.config.ts` has no Content Security Policy configuration |
| Unescaped event titles | Low | `EventDetailPanel.tsx:167` uses string interpolation with user-provided title in dialog messages |
| No recursive ZIP depth limit | Medium | See H10 |
| Zod error messages exposed to client | Low | `coach.ts:68` concatenates Zod error details which could leak schema structure |

---

## 15. Design System & Styling

### Strengths

- Well-structured Luminous Cartography design system in `globals.css`
- CSS-first Tailwind 4.x configuration (no tailwind.config file needed)
- Comprehensive design tokens: colors, spacing, shadows, transitions, radii
- Component classes (`.card`, `.btn`, `.input`, `.badge`, `.progress`) reduce inline utility classes
- 7 data layer colors with matching badge variants
- OKLCH color space for perceptually uniform colors

### Issues

| Issue | Details |
|-------|---------|
| Webkit-only scrollbar | `::-webkit-scrollbar` doesn't apply to Firefox |
| No print styles | `@media print` rules absent despite PDF export feature |
| No `prefers-color-scheme` | Only dark theme implemented; `auto` theme option in settings doesn't have corresponding CSS |
| No `prefers-reduced-motion` | Animations play regardless of user preference |
| `.noise` utility requires `position: relative` parent | Not documented; could cause layout issues if misused |

---

## 16. Summary & Recommendations

### Immediate Fixes (Critical/High)

1. **Fix validation schemas** (`db/validation.ts`) — add missing fields (`order`, `settings`, `media`, `gender`, `city`, `duration`), fix field name mismatches (`lifeExpectancy`/`expectedLifespan`, `country`/`location`)
2. **Fix IndexedDB batch error handling** — add `event.preventDefault()` in `addBatch` error handler to prevent transaction abort
3. **Fix Canvas rendering** — compute CSS variable values to hex/rgb before passing to Canvas context; fix hardcoded black text color
4. **Add `health_metrics` to `AssessmentType`** union
5. **Add `error.tsx`** at `(app)` route level wrapping the existing `ErrorBoundary` component
6. **Add `loading.tsx`** skeletons for perceived performance
7. **Add mobile responsive layout** — sidebar collapse/hamburger menu below a breakpoint
8. **Replace `window.location.href`** with Next.js router in `TimelineView.tsx`
9. **Fix GPS null island defaults** — return `undefined` location instead of `(0, 0)` coordinates
10. **Add recursive ZIP depth limit** in Facebook parser

### Short-Term Improvements

11. Extract shared `useDbData` hook from repeated `useEffect` + `Promise.all` pattern
12. Add abort signal support to all view components (currently only CoachView and ImportWizard)
13. Decompose components over 600 lines into smaller units
14. Add tests for `ErrorBoundary`, `MBTIAssessment`, `HealthMetricsAssessment`
15. Add tests for export utilities (`csvExport`, `pdfExport`, `timelineExport`)
16. Add `prefers-reduced-motion` and `prefers-color-scheme` media queries
17. Replace 5-second sidebar polling with event-driven updates
18. Add `autoComplete="off"` to API key input field

### Long-Term Considerations

19. Implement shared state management (Context or lightweight store) to eliminate prop drilling and redundant DB queries
20. Add visual regression tests for Canvas rendering
21. Configure Content Security Policy in `next.config.ts`
22. Add `robots.ts`, `sitemap.ts`, and `not-found.tsx` for completeness
23. Consider dynamic imports for `jszip` and heavy parser dependencies
24. Implement virtual scrolling for large event lists
25. Conduct formal WCAG 2.1 AA audit with automated tooling (axe-core)

---

*End of review.*
