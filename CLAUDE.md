# CLAUDE.md - Project Context for Claude Code

## Self-Improvement Directive

**This file should be continuously improved.** When working on this project, Claude should:

1. **Update the Current Status section** after completing significant features or milestones
2. **Add new conventions** discovered during development to the Key Conventions section
3. **Document new patterns** that emerge as best practices for this codebase
4. **Add new types** to the TypeScript section when core data models are created
5. **Record architectural decisions** and the reasoning behind them
6. **Update the project structure** when new directories or key files are added
7. **Add troubleshooting notes** for issues encountered and resolved
8. **Keep dependencies current** in the Tech Stack section
9. **Continuously improve tests** — add tests for new features, update tests when code changes, maintain test coverage

The goal is for this file to become increasingly useful over time, serving as the definitive guide for understanding and working with this codebase.

---

## Project Overview

**Personal Timeline** is a unified life-tracking application that consolidates data across multiple dimensions (health, finance, career, relationships, travel) with AI coaching capabilities.

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router, Turbopack)
- **Language:** TypeScript 5.x (strict mode)
- **UI:** React 19.2.3
- **Styling:** Tailwind CSS 4.x (CSS-first configuration)
- **Testing:** Vitest (unit), Playwright (E2E)
- **Storage:** IndexedDB (local-first, no backend)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Route group with sidebar layout
│   │   ├── timeline/       # Main timeline visualization
│   │   ├── insights/       # Analytics dashboard
│   │   ├── dreamboard/     # Goal planning
│   │   ├── coach/          # AI coaching chat
│   │   ├── import/         # Data import wizard
│   │   ├── assessments/    # Self-assessment tools
│   │   └── settings/       # User preferences
│   ├── globals.css         # Tailwind theme + design system
│   └── layout.tsx          # Root layout with fonts
├── components/
│   ├── server/             # React Server Components
│   └── client/             # Client Components ("use client")
├── lib/
│   ├── actions/            # Server Actions
│   ├── cache/              # Cache utilities
│   ├── db/                 # IndexedDB layer
│   └── import/             # Data import parsers (Facebook, LinkedIn, Google, CSV, ZIP)
├── providers/              # Context providers
└── types/                  # TypeScript type definitions
tests/                      # All automated tests (mirrors src/ structure)
├── components/
│   └── client/             # Client component tests
└── lib/
    ├── db/                 # Database layer tests
    └── import/             # Import parser tests
docs/                       # Project documentation
```

## Key Conventions

### Component Organization
- **Server Components** (default): Place in `components/server/`
- **Client Components**: Place in `components/client/`, must have `"use client"` directive
- Keep interactivity at the leaves of the component tree

### Styling
- Use Tailwind CSS utility classes
- Design system variables defined in `globals.css` under `@theme`
- Use CSS variables like `var(--color-accent-primary)` for theme colors
- Component classes available: `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.badge`, `.progress`

### Data Layer Colors
| Layer | Variable | Usage |
|-------|----------|-------|
| Economics | `--color-layer-economics` | Income, purchases, investments |
| Education | `--color-layer-education` | Degrees, courses, certifications |
| Work | `--color-layer-work` | Jobs, promotions, projects |
| Health | `--color-layer-health` | Medical events, fitness |
| Relationships | `--color-layer-relationships` | Family, friendships |
| Travel | `--color-layer-travel` | Trips, relocations |
| Media | `--color-layer-media` | Books, movies, music |

### TypeScript
- Core types defined in `src/types/index.ts`
- Use strict typing, avoid `any`
- Key types: `TimelineEvent`, `Goal`, `Milestone`, `UserProfile`, `DataLayer`

### Caching (Next.js 16)
- Caching is explicit and opt-in via `"use cache"` directive
- Use `cacheLife()` and `cacheTag()` for granular control
- Revalidate with `revalidateTag()` or `revalidatePath()`

### Server Actions
- Place in `src/lib/actions/`
- Use `"use server"` directive
- Validate input with Zod schemas
- Revalidate affected paths after mutations

### Testing
- **All tests live in `tests/` directory** — NOT co-located with source files
- Test structure mirrors `src/` (e.g., `src/lib/import/google.ts` → `tests/lib/import/google.test.ts`)
- Use Vitest for unit/integration tests, Playwright for E2E
- **Continuously improve tests:** When fixing bugs or adding features, add corresponding tests
- When modifying code, update existing tests to reflect changes
- Test file naming: `*.test.ts` or `*.test.tsx`

**Testing best practices:**
- Mock external dependencies (IndexedDB, file APIs) in test setup
- Use `createMockFile()` helpers for file upload tests (Node.js `File` doesn't have `text()`)
- Group related tests with `describe()` blocks
- Test both success and error/edge cases
- Keep tests focused and independent

**Commands:**
```bash
npm test              # Run all tests
npm test -- <path>    # Run specific test file
npm test -- --watch   # Watch mode
```

## Design System: Luminous Cartography

**Aesthetic:** Amber accents on dark backgrounds, life moments as illuminated points.

**Fonts:**
- Headings: Playfair Display (serif)
- Body: DM Sans (sans-serif)

**Color Palette:**
- Background: `--color-bg-primary` (near black)
- Accent: `--color-accent-primary` (amber/gold)
- Text: `--color-text-primary` (off-white)

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm test         # Run all Vitest tests
npm test -- tests/lib/import/  # Run specific test directory
```

## Architecture Principles

1. **Local-first:** All data processing happens client-side. No server uploads.
2. **Privacy by default:** IndexedDB storage, no third-party analytics.
3. **Progressive enhancement:** Core features work without JavaScript where possible.
4. **Accessibility:** Target WCAG 2.1 AA compliance.

## Documentation Reference

**Always consult these docs when working on related features:**

### Product & Requirements
| Document | When to Reference |
|----------|-------------------|
| [docs/executive-summary.md](docs/executive-summary.md) | Understanding product vision, target users, revenue model, key differentiators |
| [docs/functional-specifications.md](docs/functional-specifications.md) | Implementing any feature — contains all FR-XX-### requirements with acceptance criteria, data schemas, UI specs |

### Technical Implementation
| Document | When to Reference |
|----------|-------------------|
| [docs/nextjs-project-structure.md](docs/nextjs-project-structure.md) | Setting up new features, understanding directory layout, deployment config, CI/CD |
| [docs/nextjs-best-practices.md](docs/nextjs-best-practices.md) | Writing components, data fetching, caching, Server Actions, avoiding anti-patterns |
| [docs/nextjs-design-patterns.md](docs/nextjs-design-patterns.md) | Code examples for all patterns: streaming, parallel routes, optimistic updates, error boundaries, etc. |
| [docs/nextjs-test-plan.md](docs/nextjs-test-plan.md) | Writing tests, understanding test coverage requirements, CI integration |

### Quick Reference by Task

- **Adding a new page** → `nextjs-project-structure.md` (App Router section)
- **Creating a form** → `nextjs-design-patterns.md` (Server Actions pattern)
- **Fetching data** → `nextjs-best-practices.md` (Data Fetching Patterns)
- **Adding animations** → `nextjs-best-practices.md` (UI/Design Best Practices)
- **Implementing a feature** → `functional-specifications.md` (find the FR-XX-### requirement)
- **Writing tests** → `nextjs-test-plan.md` (Test Cases section)

## Current Status

**Completed:**
- Project initialization with Next.js 16
- Tailwind 4.x design system (Luminous Cartography)
- Collapsible sidebar navigation with dynamic data (shows real user profile, event counts, life progress)
- Core TypeScript types
- IndexedDB storage layer with full CRUD operations
- **Data Import System:**
  - 4-step import wizard (Source → Upload → Preview → Confirm)
  - Parsers for Facebook, LinkedIn, Google Takeout, and custom CSV
  - ZIP file support for all data imports (JSZip library)
  - Content-based detection for Google Keep notes (handles any filename)
  - Scalable preview UI with filtering and pagination for large imports
  - Drag-and-drop file upload with browser default prevention
- **Timeline View:**
  - Canvas-based visualization with zoom/pan controls
  - Multi-layer event rendering (work, travel, health, relationships, etc.)
  - Event filtering by layer and source
  - Event detail modal on click with edit/delete
  - Mortality curve background visualization (toggleable)
  - Auto-scrolling current year marker
  - Zoom presets (decade, year, month, week views)
  - Future goals projection overlay (toggleable)
  - Export options: PNG, JSON, PDF (print-to-PDF)
- **Insights Dashboard:**
  - Life progress tracking (age, life expectancy, years/weeks remaining)
  - Events by layer distribution chart
  - Events over time bar chart
  - Top event types ranking
  - Data sources breakdown
  - Goals overview statistics
  - Global comparisons (WHO life expectancy by country, travel benchmarks)
  - Activity heat map (events by month/year)
  - CSV export for trend data and full insights report
- **Dreamboard (Goals):**
  - Goal creation/editing form with milestones
  - Category filtering
  - Progress tracking
  - Status management (not started, in progress, completed, abandoned)
  - Drag-and-drop goal reordering
  - Goal templates (10 pre-defined templates across all categories)
- **AI Coach:**
  - Functional conversational interface
  - Context-aware responses using timeline events, goals, and assessments
  - Coaching focus toggles (Goal Progress, Life Patterns, Mental Wellness, Career Guidance)
  - Suggested prompts based on user data
  - Message history with timestamps
  - Typing indicator animation
- **Settings:**
  - User profile management (name, birth date, country, life expectancy)
  - Theme and default view preferences
  - Notification settings
  - Data export (JSON backup)
  - Data deletion with confirmation
- Comprehensive test suite (680+ tests across 20+ test files)

**Test Coverage:**
- `tests/lib/db/` — IndexedDB operations and validation (66 tests)
- `tests/lib/import/` — All import parsers + ZIP utilities (450+ tests)
- `tests/lib/utils/` — Async cleanup utilities (27 tests)
- `tests/components/client/` — UI components including all assessments (140+ tests)

**Functional Pages:**
| Page | Status | Data Source |
|------|--------|-------------|
| Timeline | ✅ Full | IndexedDB events (filtering, zoom presets, export options) |
| Insights | ✅ Full | IndexedDB events, profile, goals (heat maps, global comparisons) |
| Dreamboard | ✅ Full | IndexedDB goals (drag-and-drop, templates) |
| Import | ✅ Full | File uploads → IndexedDB |
| Settings | ✅ Full | IndexedDB profile |
| AI Coach | ✅ Full | Context-aware coaching (events, goals, assessments) |
| Assessments | ✅ Full | All 7 assessments complete |

**Assessments Implementation Status:**
| Assessment | Status | Description |
|------------|--------|-------------|
| Big Five Personality | ✅ Complete | 50-question OCEAN assessment with scoring |
| MBTI Personality Type | ✅ Complete | 20-question type indicator (E/I, S/N, T/F, J/P) |
| FIRE Calculator | ✅ Complete | Financial independence projection tool |
| Risk Tolerance | ✅ Complete | 15-question investment risk profile with 5 categories |
| Core Values | ✅ Complete | 30-value rating assessment with category breakdown |
| Cognitive Assessment | ✅ Complete | 30-question IQ-style test with timed questions |
| Health Metrics | ✅ Complete | Daily tracking for weight, blood pressure, sleep, exercise, mood |

**Next priorities:**
- LLM API integration for AI Coach (currently uses mock responses)
- More data source imports (Apple Health, Spotify, etc.)
- Sankey diagrams for life flow visualization
- Resume capability for interrupted imports
