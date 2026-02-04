# Personal Timeline — Functional Specifications

**Version:** 1.0
**Date:** February 2026
**Status:** Draft

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [User Classes & Personas](#2-user-classes--personas)
3. [System Features](#3-system-features)
4. [Data Requirements](#4-data-requirements)
5. [External Interface Requirements](#5-external-interface-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [UI/UX Specifications](#7-uiux-specifications)

---

## 1. Introduction

### 1.1 Purpose

This document defines the functional requirements for the Personal Timeline application — a unified platform that consolidates life data across multiple dimensions (health, finance, career, relationships, travel) with AI coaching capabilities.

### 1.2 Scope

Personal Timeline addresses the fragmentation problem of scattered tracking tools and subscription fatigue by providing a single, privacy-focused application for life documentation and planning.

### 1.3 Definitions & Conventions

| Term | Definition |
|------|------------|
| **Timeline Event** | A discrete data point representing a moment or period in the user's life |
| **Data Layer** | A category of life data (e.g., health, finance, career) |
| **Local-first** | Architecture where data processing occurs entirely on the user's device |
| **FR-XX-###** | Functional Requirement identifier (XX = feature area, ### = sequence) |

### 1.4 References

- Executive Summary v1.0 (February 2026)
- Design System: "Luminous Cartography"

---

## 2. User Classes & Personas

### 2.1 Primary Personas

#### Persona 1: The Seeker (Young Adult, 18-30)

**Profile:** Recent graduate or early-career professional exploring identity and direction.

**Goals:**
- Understand patterns in their choices and experiences
- Set meaningful career and personal milestones
- Track progress toward financial independence

**Pain Points:**
- Overwhelmed by multiple tracking apps
- Lacks historical perspective on their journey
- Uncertain about long-term planning

**Key Features:** Timeline visualization, Dreamboard, AI Coach

---

#### Persona 2: The Navigator (Midlife Adult, 35-55)

**Profile:** Established professional managing multiple life responsibilities.

**Goals:**
- Reassess priorities and life balance
- Track family milestones alongside career
- Plan for retirement and legacy

**Pain Points:**
- Data scattered across decades of tools
- Difficulty seeing the big picture
- Limited time for self-reflection

**Key Features:** Data Import, Insights, Timeline layers

---

#### Persona 3: The Chronicler (Retiree, 60+)

**Profile:** Individual focused on documenting their life story and legacy.

**Goals:**
- Create a comprehensive life record
- Share memories with family
- Reflect on accomplishments and lessons

**Pain Points:**
- Photos and documents in multiple formats/locations
- Technical barriers to consolidation
- Fear of losing memories

**Key Features:** Timeline visualization, Data Import, Export

---

#### Persona 4: The Mindful (Mental Health Seeker)

**Profile:** Individual using self-reflection as part of wellness practice.

**Goals:**
- Track emotional patterns over time
- Identify triggers and growth areas
- Support therapy with data

**Pain Points:**
- Journaling apps lack historical context
- Difficulty connecting life events to mental states
- Privacy concerns with cloud services

**Key Features:** AI Coach, Timeline, Local-first privacy

---

#### Persona 5: The Achiever (Career Professional)

**Profile:** Ambitious professional tracking career trajectory.

**Goals:**
- Document achievements and milestones
- Plan career transitions strategically
- Benchmark against industry norms

**Pain Points:**
- LinkedIn doesn't capture the full picture
- No unified view of skills development
- Difficulty articulating career narrative

**Key Features:** Insights, Timeline, Dreamboard

---

### 2.2 Use Case Summary

| Use Case | Primary Persona | Priority |
|----------|-----------------|----------|
| UC-01: View life timeline | All | Critical |
| UC-02: Import social media data | Navigator, Chronicler | High |
| UC-03: Set and track goals | Seeker, Achiever | High |
| UC-04: Get AI coaching | Seeker, Mindful | High |
| UC-05: Compare to benchmarks | Achiever, Navigator | Medium |
| UC-06: Complete assessments | Seeker, Achiever | Medium |
| UC-07: Export life data | Chronicler | Medium |

---

## 3. System Features

### 3.1 Timeline View

The primary visualization of the user's life events across time.

#### FR-TL-001: Chronological Timeline Display

**Description:** Display an interactive timeline with the user's age (or calendar years) on the x-axis.

**Acceptance Criteria:**
- Timeline spans from birth year to projected lifespan
- X-axis supports both age-based and year-based display modes
- Current date/age is clearly indicated
- Timeline is horizontally scrollable

---

#### FR-TL-002: Mortality Rate Curve Background

**Description:** Render an ambient mortality rate curve as background context.

**Acceptance Criteria:**
- Curve displays actuarial mortality probability by age
- Visualization is subtle (low opacity) to avoid being morbid
- Curve adjusts based on user's demographic data if provided
- User can toggle visibility on/off

---

#### FR-TL-003: Multi-Dimensional Data Layers

**Description:** Support multiple data layers that can be toggled independently.

**Data Layers:**
| Layer | Color Code | Example Events |
|-------|------------|----------------|
| Economics | Green | Income changes, purchases, investments |
| Education | Blue | Degrees, courses, certifications |
| Work | Purple | Jobs, promotions, projects |
| Health | Red | Medical events, fitness milestones |
| Relationships | Pink | Relationships, family events |
| Travel | Orange | Trips, relocations |
| Media | Yellow | Books, movies, music discoveries |

**Acceptance Criteria:**
- Each layer has a distinct visual style
- Layers can be shown/hidden via toggle controls
- Multiple layers can be visible simultaneously
- Layer visibility persists across sessions

---

#### FR-TL-004: Zoom and Pan Navigation

**Description:** Enable users to navigate the timeline through zoom and pan gestures.

**Acceptance Criteria:**
- Pinch-to-zoom on touch devices
- Scroll wheel zoom on desktop
- Click-and-drag panning
- Zoom levels: decade view, year view, month view, week view
- Smooth animated transitions between zoom levels

---

#### FR-TL-005: Event Filtering

**Description:** Filter timeline events by source and type.

**Acceptance Criteria:**
- Filter by data source (Facebook, LinkedIn, Google, Manual)
- Filter by event type within each layer
- Filters are combinable (AND logic)
- Active filters are visually indicated
- "Clear all filters" option available

---

#### FR-TL-006: Canvas Rendering

**Description:** Render timeline using HTML5 Canvas for performance.

**Acceptance Criteria:**
- Smooth 60fps rendering with 1000+ events visible
- Efficient re-rendering on zoom/pan
- Event clustering when zoomed out
- Click/tap detection for event selection
- Fallback rendering for accessibility

---

#### FR-TL-007: Event Detail View

**Description:** Display detailed information for selected events.

**Acceptance Criteria:**
- Click/tap event to open detail panel
- Shows: title, date, description, source, attached media
- Edit capability for manual events
- Delete capability with confirmation
- Navigation to related events

---

### 3.2 Insights View

Analytics dashboard comparing user data to global averages.

#### FR-IN-001: Analytics Dashboard

**Description:** Display a dashboard with key life metrics and analytics.

**Acceptance Criteria:**
- Dashboard loads within 2 seconds
- Displays 4-6 primary metric cards
- Responsive layout for different screen sizes
- Data refreshes when underlying data changes

---

#### FR-IN-002: Global Comparisons

**Description:** Compare user metrics to relevant global or demographic averages.

**Comparison Metrics:**
| Metric | Data Source | Visualization |
|--------|-------------|---------------|
| Life expectancy | WHO data | Progress bar with projection |
| Income percentile | National statistics | Percentile indicator |
| Education level | Census data | Comparative chart |
| Career milestones | Industry benchmarks | Timeline comparison |
| Travel coverage | Geographic data | World map heat map |

**Acceptance Criteria:**
- Clear indication of data sources
- User can opt out of comparisons
- Comparisons use anonymized aggregate data
- Demographic filters (country, age group) available

---

#### FR-IN-003: Trend Analysis

**Description:** Generate trend visualizations for user data over time.

**Acceptance Criteria:**
- Line charts for continuous metrics (income, weight, etc.)
- Milestone markers on trend lines
- Trend direction indicators (improving/declining)
- Customizable time range selection
- Export trend data as CSV

---

#### FR-IN-004: Data Visualizations

**Description:** Provide rich data visualizations for insights.

**Visualization Types:**
- Line charts (trends over time)
- Bar charts (categorical comparisons)
- Pie/donut charts (proportions)
- Heat maps (activity patterns)
- Sankey diagrams (life flow)

**Acceptance Criteria:**
- Interactive tooltips on all visualizations
- Consistent color coding with data layers
- Accessible alternatives (data tables)
- Print-friendly versions

---

### 3.3 Dreamboard View

Future goal visualization and milestone planning.

#### FR-DB-001: Goal Management

**Description:** Create, edit, and manage future goals.

**Goal Properties:**
| Property | Type | Required |
|----------|------|----------|
| Title | String (100 chars) | Yes |
| Description | String (1000 chars) | No |
| Category | Enum (Career, Health, Finance, Personal, Relationship, Travel) | Yes |
| Target Date | Date | No |
| Priority | Enum (High, Medium, Low) | No |
| Status | Enum (Not Started, In Progress, Completed, Abandoned) | Yes |

**Acceptance Criteria:**
- CRUD operations for goals
- Drag-and-drop reordering
- Bulk status updates
- Goal templates for common objectives

---

#### FR-DB-002: Milestone Planning

**Description:** Define milestones within goals with target dates.

**Acceptance Criteria:**
- Multiple milestones per goal
- Milestone completion tracking
- Deadline notifications (optional)
- Milestone dependencies (optional)
- Progress percentage calculation

---

#### FR-DB-003: Visual Progress Tracking

**Description:** Display goal progress through visual indicators.

**Acceptance Criteria:**
- Progress bars for milestone completion
- Visual distinction by goal category
- "On track" / "At risk" / "Behind" indicators
- Celebration animations on completion

---

#### FR-DB-004: Timeline Projection

**Description:** Display goals and milestones on the main timeline as future events.

**Acceptance Criteria:**
- Goals appear on timeline in a distinct "future" visual style
- Connecting lines from present to goal targets
- Toggle to show/hide projected events
- Goals update on timeline when dates change

---

### 3.4 AI Coach View

Virtual assistant for coaching, mental health support, and goal tracking.

#### FR-AC-001: Conversational Interface

**Description:** Provide a chat-based interface for AI interactions.

**Acceptance Criteria:**
- Text input with send button
- Message history display
- Typing indicator during AI response
- Markdown rendering in responses
- Copy message functionality

---

#### FR-AC-002: Coaching Prompts

**Description:** AI provides proactive coaching prompts and guidance.

**Coaching Areas:**
- Goal setting and refinement
- Progress celebration
- Obstacle identification
- Motivation and accountability
- Life balance assessment

**Acceptance Criteria:**
- Context-aware prompts based on user data
- Customizable coaching frequency
- Opt-out capability
- Prompts appear as notifications or in-app cards

---

#### FR-AC-003: Mental Health Support

**Description:** Provide supportive features for mental wellness.

**Acceptance Criteria:**
- Mood check-in prompts
- Journaling suggestions
- Cognitive reframing exercises
- Crisis resource links (when appropriate)
- Clear disclaimer that this is not therapy

---

#### FR-AC-004: Goal Integration

**Description:** AI has context of user's goals for relevant coaching.

**Acceptance Criteria:**
- AI can reference active goals in conversation
- Suggests actions based on goal progress
- Celebrates milestone completions
- Identifies goals that may need attention

---

#### FR-AC-005: Context-Aware Recommendations

**Description:** AI provides recommendations based on user's timeline data.

**Acceptance Criteria:**
- Recommendations reference specific timeline events
- Pattern recognition (e.g., "You tend to feel better after travel")
- Actionable suggestions with links to features
- User can rate recommendation helpfulness

---

### 3.5 Data Import System

Import wizard for bringing in data from external sources.

#### FR-DI-001: Import Wizard

**Description:** 4-step wizard for data imports.

**Steps:**
1. **Guide:** Explain the import process and privacy
2. **Upload:** Select and upload export files
3. **Select:** Choose which data to import
4. **Confirm:** Review and confirm import

**Acceptance Criteria:**
- Progress indicator showing current step
- Back/Next navigation
- Cancel with confirmation
- Help text at each step
- Resume capability for interrupted imports

---

#### FR-DI-002: Facebook Data Parser

**Description:** Parse Facebook data export files.

**Supported Data:**
| Data Type | File Path | Timeline Mapping |
|-----------|-----------|------------------|
| Posts | posts/your_posts.json | Media layer events |
| Photos | photos_and_videos/ | Media layer events |
| Events | events/your_events.json | Multiple layers |
| Friends | friends/friends.json | Relationship layer |
| Places | location/your_places.json | Travel layer |

**Acceptance Criteria:**
- Support for Facebook JSON export format
- Handle missing or malformed files gracefully
- Preview parsed data before import
- Duplicate detection

---

#### FR-DI-003: LinkedIn Data Parser

**Description:** Parse LinkedIn data export files.

**Supported Data:**
| Data Type | File Path | Timeline Mapping |
|-----------|-----------|------------------|
| Positions | Positions.csv | Work layer |
| Education | Education.csv | Education layer |
| Skills | Skills.csv | Work layer metadata |
| Connections | Connections.csv | Relationship layer |

**Acceptance Criteria:**
- Support for LinkedIn CSV export format
- Date parsing for various formats
- Company/institution name normalization
- Merge with existing work/education entries

---

#### FR-DI-004: Google Takeout Parser

**Description:** Parse Google Takeout export files.

**Supported Data:**
| Service | Data Type | Timeline Mapping |
|---------|-----------|------------------|
| Keep | Notes | Multiple layers |
| Photos | Images + metadata | Media layer |
| Calendar | Events | Multiple layers |
| Location History | Location records | Travel layer |

**Acceptance Criteria:**
- Support for Google Takeout folder structure
- Handle large photo libraries efficiently
- Location history clustering
- Calendar event categorization

---

#### FR-DI-005: Local-First Processing

**Description:** All import processing occurs on the user's device.

**Acceptance Criteria:**
- No file upload to external servers
- Processing in browser using Web Workers
- Clear indication that data stays local
- Support for large files (1GB+) without crashing

---

#### FR-DI-006: Data Mapping

**Description:** Map imported data to timeline event structure.

**Acceptance Criteria:**
- Automatic layer assignment based on data type
- User can override automatic assignments
- Date extraction from various formats
- Title/description generation from raw data
- Confidence scores for automatic mappings

---

### 3.6 Personal Assessments

Self-assessment tools for personality, intelligence, and planning.

#### FR-PA-001: IQ Test Interface

**Description:** Provide IQ assessment functionality.

**Acceptance Criteria:**
- Timed test format
- Multiple question types (pattern, verbal, numerical)
- Results with percentile ranking
- Historical results tracking
- Disclaimer about limitations of IQ testing

---

#### FR-PA-002: Personality Assessments

**Description:** Personality profiling tools.

**Supported Frameworks:**
- Big Five (OCEAN)
- MBTI-style indicators
- Values assessment

**Acceptance Criteria:**
- Clear, accessible question format
- Results visualization (radar charts, etc.)
- Comparison to previous assessments
- Export results as PDF

---

#### FR-PA-003: Risk Tolerance Questionnaire

**Description:** Assess user's risk tolerance for financial planning.

**Acceptance Criteria:**
- Standardized risk assessment questions
- Score on conservative-aggressive spectrum
- Integration with financial planning features
- Periodic reassessment prompts

---

#### FR-PA-004: Financial Planning Tools

**Description:** FIRE (Financial Independence, Retire Early) calculators.

**Tools:**
- Net worth tracker
- Savings rate calculator
- FIRE number calculator
- Investment projection

**Acceptance Criteria:**
- Input fields for financial data
- Projection visualizations
- Scenario comparison (different savings rates)
- Integration with timeline (projected milestones)

---

#### FR-PA-005: Health Metrics Tracking

**Description:** Manual input for health and wellness metrics.

**Metrics:**
| Metric | Unit | Frequency |
|--------|------|-----------|
| Weight | kg/lb | Daily/Weekly |
| Blood pressure | mmHg | As measured |
| Sleep | Hours | Daily |
| Exercise | Minutes | Daily |
| Mood | Scale 1-10 | Daily |

**Acceptance Criteria:**
- Quick-entry interface
- Trend charts for each metric
- Goal setting for health targets
- Reminder notifications (optional)

---

### 3.7 Sidebar & Navigation

Primary navigation and life progress display.

#### FR-SB-001: Collapsible Sidebar

**Description:** Main navigation sidebar that can collapse to save space.

**Acceptance Criteria:**
- Expand/collapse toggle
- Collapsed state shows icons only
- Smooth animation on state change
- State persists across sessions
- Touch-friendly on mobile

---

#### FR-SB-002: Life Progress Indicators

**Description:** Display life progress metrics in sidebar.

**Indicators:**
- Age / Life expectancy progress bar
- Current year progress
- Goal completion rate
- Data completeness score

**Acceptance Criteria:**
- Visual progress bars/rings
- Tooltips with detailed numbers
- Update in real-time as data changes

---

#### FR-SB-003: View Navigation

**Description:** Quick navigation between main views.

**Navigation Items:**
- Timeline
- Insights
- Dreamboard
- AI Coach
- Import Data
- Assessments
- Settings

**Acceptance Criteria:**
- Current view clearly indicated
- Keyboard shortcuts for navigation
- Badge indicators for notifications
- Consistent ordering

---

#### FR-SB-004: User Profile Summary

**Description:** Display user profile information in sidebar.

**Acceptance Criteria:**
- User name/avatar display
- Quick stats (events count, goals count)
- Link to full profile settings
- Last sync/update timestamp

---

## 4. Data Requirements

### 4.1 User Profile Schema

```
UserProfile {
  id: UUID
  name: String
  birthDate: Date
  country: String (ISO 3166-1)
  gender: Enum (optional)
  lifeExpectancy: Number (calculated)
  createdAt: DateTime
  updatedAt: DateTime
  settings: UserSettings
}

UserSettings {
  theme: Enum (dark, light, auto)
  defaultView: Enum (timeline, insights, dreamboard, coach)
  sidebarCollapsed: Boolean
  notifications: NotificationSettings
  privacy: PrivacySettings
}
```

### 4.2 Timeline Event Schema

```
TimelineEvent {
  id: UUID
  userId: UUID
  title: String (200 chars)
  description: String (2000 chars, optional)
  startDate: Date
  endDate: Date (optional, for periods)
  layer: Enum (economics, education, work, health, relationships, travel, media)
  eventType: String (layer-specific)
  source: Enum (manual, facebook, linkedin, google, other)
  sourceId: String (optional, for deduplication)
  location: GeoLocation (optional)
  media: MediaAttachment[] (optional)
  metadata: JSON (flexible additional data)
  createdAt: DateTime
  updatedAt: DateTime
}

MediaAttachment {
  id: UUID
  type: Enum (image, video, document)
  url: String (local file reference)
  thumbnail: String (optional)
  caption: String (optional)
}
```

### 4.3 Goal Schema

```
Goal {
  id: UUID
  userId: UUID
  title: String (100 chars)
  description: String (1000 chars, optional)
  category: Enum (career, health, finance, personal, relationship, travel)
  targetDate: Date (optional)
  priority: Enum (high, medium, low)
  status: Enum (not_started, in_progress, completed, abandoned)
  milestones: Milestone[]
  createdAt: DateTime
  updatedAt: DateTime
}

Milestone {
  id: UUID
  title: String (100 chars)
  targetDate: Date (optional)
  completed: Boolean
  completedAt: DateTime (optional)
}
```

### 4.4 Assessment Results Schema

```
AssessmentResult {
  id: UUID
  userId: UUID
  assessmentType: Enum (iq, personality_big5, personality_mbti, risk_tolerance, values)
  completedAt: DateTime
  scores: JSON (assessment-specific structure)
  duration: Number (seconds)
}
```

### 4.5 Storage Requirements

| Data Type | Storage Location | Sync Strategy |
|-----------|------------------|---------------|
| User Profile | IndexedDB | Local only (MVP) |
| Timeline Events | IndexedDB | Local only (MVP) |
| Goals | IndexedDB | Local only (MVP) |
| Assessments | IndexedDB | Local only (MVP) |
| Media Files | File System API | Local only |
| Settings | localStorage | Local only |

---

## 5. External Interface Requirements

### 5.1 File Import Formats

| Source | Format | Max Size |
|--------|--------|----------|
| Facebook | JSON (zip archive) | 10 GB |
| LinkedIn | CSV (zip archive) | 100 MB |
| Google Takeout | JSON/MBOX (zip) | 50 GB |
| Manual CSV | CSV | 10 MB |

### 5.2 Export Formats

| Format | Use Case |
|--------|----------|
| JSON | Full data backup |
| CSV | Spreadsheet analysis |
| PDF | Print/share timeline |
| PNG/SVG | Timeline image export |

### 5.3 Browser Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 120+ |
| Firefox | 120+ |
| Safari | 17+ |
| Edge | 120+ |

**Required APIs:**
- IndexedDB
- File System Access API
- Web Workers
- Canvas API
- Intersection Observer

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target |
|--------|--------|
| Initial page load | < 3 seconds |
| Timeline render (1000 events) | < 500ms |
| Zoom/pan frame rate | 60 fps |
| Data import (1GB file) | < 5 minutes |
| Search results | < 200ms |

### 6.2 Privacy & Security

- **NFR-PR-001:** All data processing occurs client-side
- **NFR-PR-002:** No data transmitted to external servers (MVP)
- **NFR-PR-003:** Optional data encryption at rest
- **NFR-PR-004:** No third-party analytics or tracking
- **NFR-PR-005:** Clear data deletion capability

### 6.3 Accessibility

- **NFR-AC-001:** WCAG 2.1 AA compliance
- **NFR-AC-002:** Keyboard navigation for all features
- **NFR-AC-003:** Screen reader compatible
- **NFR-AC-004:** Color contrast ratios meet standards
- **NFR-AC-005:** Text scaling support (up to 200%)

### 6.4 Responsiveness

| Breakpoint | Target Devices |
|------------|----------------|
| < 640px | Mobile phones |
| 640-1024px | Tablets |
| 1024-1440px | Laptops |
| > 1440px | Desktops |

---

## 7. UI/UX Specifications

### 7.1 Design System: Luminous Cartography

**Concept:** Life moments as illuminated points along a journey, amber accents on dark backgrounds.

### 7.2 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | #0D0D0D | Main background |
| `--bg-secondary` | #1A1A1A | Card backgrounds |
| `--bg-elevated` | #262626 | Elevated surfaces |
| `--accent-primary` | #F5A623 | Primary amber accent |
| `--accent-secondary` | #D4920A | Secondary amber |
| `--text-primary` | #FFFFFF | Primary text |
| `--text-secondary` | #A3A3A3 | Secondary text |
| `--text-muted` | #666666 | Muted text |
| `--success` | #22C55E | Success states |
| `--warning` | #EAB308 | Warning states |
| `--error` | #EF4444 | Error states |

**Data Layer Colors:**
| Layer | Color |
|-------|-------|
| Economics | #22C55E (Green) |
| Education | #3B82F6 (Blue) |
| Work | #8B5CF6 (Purple) |
| Health | #EF4444 (Red) |
| Relationships | #EC4899 (Pink) |
| Travel | #F97316 (Orange) |
| Media | #EAB308 (Yellow) |

### 7.3 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| H1 | Playfair Display | 700 | 48px |
| H2 | Playfair Display | 600 | 36px |
| H3 | Playfair Display | 600 | 24px |
| H4 | DM Sans | 600 | 20px |
| Body | DM Sans | 400 | 16px |
| Body Small | DM Sans | 400 | 14px |
| Caption | DM Sans | 400 | 12px |
| Button | DM Sans | 500 | 14px |

### 7.4 Spacing Scale

```
4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px
```

### 7.5 Component Library Outline

**Core Components:**
- Button (primary, secondary, ghost, icon)
- Input (text, number, date, textarea)
- Select (single, multi)
- Card (default, interactive, elevated)
- Modal (default, fullscreen)
- Toast (success, error, info, warning)
- Tooltip
- Badge
- Progress (bar, ring)
- Avatar
- Tabs
- Accordion

**Feature Components:**
- TimelineCanvas
- EventCard
- GoalCard
- MilestoneList
- ChatMessage
- ImportWizardStep
- AssessmentQuestion
- MetricCard
- LayerToggle
- DateRangePicker

---

## Appendix A: Requirement Traceability Matrix

| Requirement | Executive Summary Section | Priority |
|-------------|---------------------------|----------|
| FR-TL-001 to FR-TL-007 | Timeline Visualization | Critical |
| FR-IN-001 to FR-IN-004 | Four Main Views - Insights | High |
| FR-DB-001 to FR-DB-004 | Four Main Views - Dreamboard | High |
| FR-AC-001 to FR-AC-005 | Four Main Views - AI Coach | High |
| FR-DI-001 to FR-DI-006 | Data Import System | High |
| FR-PA-001 to FR-PA-005 | Personal Assessment Tools | Medium |
| FR-SB-001 to FR-SB-004 | Design Identity - Sidebar | Medium |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| FIRE | Financial Independence, Retire Early — a movement focused on extreme savings and investment |
| IndexedDB | Browser-based database for storing structured data client-side |
| Local-first | Software architecture prioritizing local data storage and processing |
| WCAG | Web Content Accessibility Guidelines |
| Web Workers | Browser API for running scripts in background threads |

---

*Document generated February 2026*
