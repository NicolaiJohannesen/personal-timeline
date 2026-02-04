# personal timeline apps functionality — Executive Summary

## Core Value Proposition

A unified personal timeline that consolidates life data across multiple dimensions (health, finance, career, relationships, travel) with AI coaching — solving the fragmentation problem of scattered tracking tools and subscription fatigue.

---

## Primary Features

### 1. Timeline Visualization

- Scalable timeline with age/year on x-axis, mortality rate curve as ambient background context
- Multi-dimensional data layers: economics, education, work, health, relationships, travel, media
- Interactive HTML5 canvas rendering

### 2. Four Main Views

| View | Purpose |
|------|---------|
| **Timeline** | Chronological life events with filtering by source/type |
| **Insights** | Analytics comparing user data to global averages (lifespan, income, education) |
| **Dreamboard** | Future goal visualization and milestone planning |
| **AI Coach** | Virtual assistant for coaching, mental health support, goal tracking |

### 3. Data Import System

- 4-step wizard: Guide → Upload → Select → Confirm
- **Priority sources:** Facebook, LinkedIn, Google Takeout (Keep, Photos, Calendar, Location History)
- Local-first processing (files never leave device)
- Manual export uploads — no API dependency for core functionality

### 4. Personal Assessment Tools

- IQ tests, personality assessments, risk tolerance metrics
- Financial planning (FIRE strategies, investment tracking)
- Health metrics and wellness goals

---

## Design Identity

**"Luminous Cartography"** — amber accents on dark backgrounds, life moments as illuminated points along a journey.

- Editorial/magazine aesthetics
- Typography: Playfair Display (headings), DM Sans (body)
- Collapsible sidebar with life progress tracking

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.x |
| Language | TypeScript 5.9.x |
| Styling | Tailwind CSS 4.x |
| UI Library | React 19.2 |
| Bundler | Turbopack (default) |
| Testing | Vitest, Playwright |

---

## Target Users

1. **Young Adults** — seeking direction, exploring identity, starting careers
2. **Midlife Adults** — reassessing priorities, managing multiple life aspects
3. **Retirees** — documenting legacy, reflecting on life journey
4. **Mental Health Seekers** — self-reflection, emotional tracking, therapy support
5. **Career Professionals** — tracking milestones, planning transitions

---

## Revenue Model

**Freemium:**
- Free: Basic timeline and planner
- Premium: AI coaching, in-depth analytics, advanced integrations

**Partnerships:** Financial planners, health apps, educational platforms

---

## Key Differentiators

1. **Holistic integration** — single platform vs. fragmented tools
2. **Mortality curve context** — subtle urgency without being morbid
3. **Local-first privacy** — data processing happens on device
4. **Distinctive aesthetics** — avoids generic "AI slop" design patterns

---

*Version 1.0 • February 2026*
