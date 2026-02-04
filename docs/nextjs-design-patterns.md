# Next.js 16.x Design Patterns

*Updated: February 2026*

Design patterns optimized for **Next.js 16.x**, leveraging Turbopack, Cache Components, React 19.2, and the stable React Compiler.

## 1. App Router Pattern

The App Router is the standard for Next.js 16. The Pages Router is deprecated for new projects.

```
app/
├── layout.tsx          # Root layout
├── page.tsx            # Home page
├── loading.tsx         # Loading UI
├── error.tsx           # Error boundary
├── not-found.tsx       # 404 page
├── timeline/
│   ├── layout.tsx      # Nested layout
│   ├── page.tsx        # /timeline
│   └── [id]/
│       └── page.tsx    # /timeline/:id
└── api/
    └── events/
        └── route.ts    # API route
```

```tsx
// app/page.tsx
export default function Home() {
  return <h1>Welcome to LifeMap</h1>;
}
```

## 2. Server Component Pattern (Default)

All components are Server Components by default. They run only on the server.

```tsx
// app/timeline/page.tsx
import { db } from '@/lib/db';

export default async function TimelinePage() {
  // Direct database access - no API needed
  const events = await db.event.findMany({
    orderBy: { date: 'desc' },
  });
  
  return (
    <main>
      <h1>Your Timeline</h1>
      <EventList events={events} />
    </main>
  );
}
```

**Benefits:**
- Zero client-side JavaScript for data fetching
- Direct access to backend resources
- Smaller bundle sizes
- Better SEO (full HTML sent to client)

## 3. Client Component Pattern

Use `"use client"` directive for interactive components.

```tsx
// components/client/EventFilter.tsx
"use client";

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function EventFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const handleFilterChange = (filter: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set('filter', filter);
      router.push(`?${params.toString()}`);
    });
  };
  
  return (
    <select 
      onChange={(e) => handleFilterChange(e.target.value)}
      disabled={isPending}
    >
      <option value="all">All Events</option>
      <option value="work">Work</option>
      <option value="personal">Personal</option>
    </select>
  );
}
```

## 4. Cache Components Pattern (`"use cache"`)

**New in Next.js 16:** Explicit, opt-in caching replaces the implicit caching from earlier versions.

### Page-Level Caching
```tsx
// app/stats/page.tsx
"use cache"

export default async function StatsPage() {
  const stats = await computeExpensiveStats();
  return <StatsDisplay stats={stats} />;
}
```

### Function-Level Caching
```tsx
// lib/data.ts
import { cacheLife, cacheTag } from 'next/cache';

export async function getPublicTimeline() {
  "use cache"
  cacheLife('days');  // Cache for days
  cacheTag('public-timeline');
  
  return db.event.findMany({
    where: { isPublic: true },
  });
}

export async function getUserTimeline(userId: string) {
  "use cache"
  cacheLife('minutes');  // Cache for minutes
  cacheTag(`user-${userId}`);
  
  return db.event.findMany({
    where: { userId },
  });
}
```

### Revalidation Pattern
```tsx
// app/actions/events.ts
"use server"

import { revalidateTag, revalidatePath } from 'next/cache';

export async function createEvent(data: EventData) {
  const event = await db.event.create({ data });
  
  // Targeted revalidation
  revalidateTag(`user-${data.userId}`);
  
  // Path revalidation
  revalidatePath('/timeline');
  
  return event;
}
```

## 5. Streaming and Suspense Pattern

Render fast content immediately, stream slow content progressively.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Fast: renders immediately */}
      <UserGreeting />
      
      {/* Slow: streams in with skeleton */}
      <Suspense fallback={<StatsSkeleton />}>
        <SlowStats />
      </Suspense>
      
      <Suspense fallback={<TimelineSkeleton />}>
        <RecentTimeline />
      </Suspense>
    </div>
  );
}

async function SlowStats() {
  const stats = await computeSlowStats(); // 2-3 second operation
  return <StatsCard stats={stats} />;
}
```

### Nested Suspense for Granular Loading
```tsx
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MainContent>
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      </MainContent>
    </Suspense>
  );
}
```

## 6. Route Handler Pattern

API routes for external integrations, webhooks, and non-UI endpoints.

```tsx
// app/api/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '10');
  
  const events = await db.event.findMany({
    where: { userId: session.user.id },
    take: limit,
  });
  
  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const data = await request.json();
  const event = await db.event.create({
    data: { ...data, userId: session.user.id },
  });
  
  return NextResponse.json(event, { status: 201 });
}
```

## 7. Server Actions Pattern

Replace client-side API calls with Server Actions for mutations.

```tsx
// app/actions/timeline.ts
"use server"

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

const EventSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().datetime(),
  category: z.enum(['work', 'personal', 'health', 'education']),
});

export async function addEvent(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');
  
  const validated = EventSchema.parse({
    title: formData.get('title'),
    date: formData.get('date'),
    category: formData.get('category'),
  });
  
  await db.event.create({
    data: { ...validated, userId: session.user.id },
  });
  
  revalidatePath('/timeline');
}
```

### Using Server Actions in Forms
```tsx
// components/client/AddEventForm.tsx
"use client";

import { useActionState } from 'react';
import { addEvent } from '@/app/actions/timeline';

export function AddEventForm() {
  const [error, action, isPending] = useActionState(addEvent, null);
  
  return (
    <form action={action}>
      <input name="title" placeholder="Event title" required />
      <input name="date" type="datetime-local" required />
      <select name="category">
        <option value="personal">Personal</option>
        <option value="work">Work</option>
      </select>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Adding...' : 'Add Event'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
}
```

## 8. Middleware Pattern

Global request handling for auth, redirects, and headers.

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Auth check
  const token = request.cookies.get('session-token');
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

## 9. Parallel Routes Pattern

Render multiple pages simultaneously in the same layout.

```
app/
├── layout.tsx
├── page.tsx
├── @modal/
│   └── (.)event/[id]/page.tsx  # Intercepted modal
└── event/
    └── [id]/page.tsx           # Full page
```

```tsx
// app/layout.tsx
export default function Layout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

## 10. Intercepting Routes Pattern

Show modals while preserving URL shareability.

```tsx
// app/@modal/(.)event/[id]/page.tsx
import { Modal } from '@/components/Modal';

export default async function EventModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;  // Note: params is async in Next.js 16
  const event = await getEvent(id);
  
  return (
    <Modal>
      <EventDetails event={event} />
    </Modal>
  );
}
```

## 11. Optimistic Updates Pattern

```tsx
"use client";

import { useOptimistic, useTransition } from 'react';
import { addEvent } from '@/app/actions/timeline';

export function OptimisticTimeline({ events }) {
  const [optimisticEvents, addOptimisticEvent] = useOptimistic(
    events,
    (state, newEvent) => [...state, { ...newEvent, pending: true }]
  );
  const [isPending, startTransition] = useTransition();
  
  const handleAdd = async (formData: FormData) => {
    const newEvent = {
      id: crypto.randomUUID(),
      title: formData.get('title'),
      date: formData.get('date'),
    };
    
    startTransition(async () => {
      addOptimisticEvent(newEvent);
      await addEvent(formData);
    });
  };
  
  return (
    <>
      <EventList events={optimisticEvents} />
      <form action={handleAdd}>
        {/* form fields */}
      </form>
    </>
  );
}
```

## 12. Error Boundary Pattern

```tsx
// app/timeline/error.tsx
"use client";

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error(error);
  }, [error]);
  
  return (
    <div className="p-4 bg-red-50 rounded">
      <h2 className="text-red-800">Something went wrong!</h2>
      <p className="text-red-600">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
      >
        Try again
      </button>
    </div>
  );
}
```

## 13. React Compiler Pattern

With React Compiler enabled, manual memoization is rarely needed:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  reactCompiler: true,
};
```

**Before (manual):**
```tsx
const MemoizedComponent = React.memo(({ data }) => {
  const processed = useMemo(() => expensiveProcess(data), [data]);
  const handler = useCallback(() => doSomething(data), [data]);
  return <div onClick={handler}>{processed}</div>;
});
```

**After (automatic):**
```tsx
function Component({ data }) {
  const processed = expensiveProcess(data);  // Auto-memoized
  const handler = () => doSomething(data);   // Auto-memoized
  return <div onClick={handler}>{processed}</div>;
}
```

## 14. View Transitions Pattern (React 19.2)

```tsx
"use client";

import { useRouter } from 'next/navigation';

export function AnimatedNavigation({ href, children }) {
  const router = useRouter();
  
  const navigate = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!document.startViewTransition) {
      router.push(href);
      return;
    }
    
    document.startViewTransition(() => {
      router.push(href);
    });
  };
  
  return (
    <a href={href} onClick={navigate}>
      {children}
    </a>
  );
}
```

```css
/* globals.css */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
}
```

## 15. Design System Pattern

Separate static design elements (Server Components) from interactive ones (Client Components).

### Static Visual Components (Server)
```tsx
// components/server/Hero.tsx
import Image from 'next/image';

export function Hero({ title, subtitle }) {
  return (
    <section className="relative min-h-[80vh] flex items-center">
      {/* Background texture - pure CSS */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface-primary to-surface-elevated opacity-90" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 mix-blend-overlay" />
      
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-8">
        <h1 className="font-display text-6xl tracking-tight text-balance">
          {title}
        </h1>
        <p className="mt-6 text-xl text-text-muted max-w-2xl">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
```

### Animated Wrapper (Client)
```tsx
// components/client/FadeIn.tsx
"use client";

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const directionOffsets = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
};

export function FadeIn({ children, delay = 0, direction = 'up' }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

### Composing Server + Client
```tsx
// app/page.tsx (Server Component)
import { Hero } from '@/components/server/Hero';
import { FadeIn } from '@/components/client/FadeIn';
import { FeatureGrid } from '@/components/server/FeatureGrid';

export default function HomePage() {
  return (
    <main>
      <Hero 
        title="Navigate Your Life Journey" 
        subtitle="Visualize your past, present, and future in one beautiful timeline."
      />
      
      <FadeIn delay={0.2}>
        <FeatureGrid features={features} />
      </FadeIn>
    </main>
  );
}
```

## 16. Theme Toggle Pattern

```tsx
// components/client/ThemeToggle.tsx
"use client";

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(stored ?? preferred);
  }, []);
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  return (
    <button
      onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-full hover:bg-surface-elevated transition-colors"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Dark Mode CSS
```css
/* globals.css */
@theme {
  /* Light theme (default) */
  --color-surface: oklch(0.98 0.01 280);
  --color-text: oklch(0.15 0.02 280);
}

.dark {
  --color-surface: oklch(0.12 0.02 280);
  --color-text: oklch(0.95 0.01 280);
}
```

## Summary

| Pattern | Use Case |
|---------|----------|
| Server Components | Data fetching, static content |
| Client Components | Interactivity, browser APIs |
| Cache Components | Explicit caching with `"use cache"` |
| Streaming/Suspense | Progressive loading |
| Server Actions | Form submissions, mutations |
| Route Handlers | External APIs, webhooks |
| Middleware | Auth, redirects, headers |
| Parallel Routes | Multiple views in one layout |
| Optimistic Updates | Instant UI feedback |
| React Compiler | Automatic memoization |
| Design System | Static visuals (Server) + animations (Client) |
| Theme Toggle | Dark/light mode with localStorage |
