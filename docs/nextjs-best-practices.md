# Next.js 16.x Best Practices

*Updated: February 2026*

Best practices for **Next.js 16.x** when working with Server Components (SC), Client Components (CC), Cache Components, and Context Providers.

## 1. Server vs Client Component Strategy

### Server Components (Default)
Use for:
- Data fetching
- Accessing backend resources directly
- Keeping sensitive logic server-side
- Reducing client JavaScript bundle

```tsx
// app/timeline/page.tsx (Server Component - default)
export default async function TimelinePage() {
  const events = await db.timelineEvents.findMany();
  return <TimelineView events={events} />;
}
```

### Client Components
Use for:
- Interactivity (onClick, onChange)
- Browser APIs (localStorage, geolocation)
- React hooks (useState, useEffect, useContext)
- Third-party client-only libraries

```tsx
// components/client/InteractiveTimeline.tsx
"use client";

import { useState, useTransition } from 'react';

export function InteractiveTimeline({ initialEvents }) {
  const [events, setEvents] = useState(initialEvents);
  const [isPending, startTransition] = useTransition();
  
  const handleAddEvent = (event) => {
    startTransition(() => {
      setEvents(prev => [...prev, event]);
    });
  };
  
  return (
    <div>
      {events.map(e => <EventCard key={e.id} event={e} />)}
      <AddEventButton onAdd={handleAddEvent} disabled={isPending} />
    </div>
  );
}
```

## 2. Cache Components with `"use cache"`

**Key change in Next.js 16:** Caching is now explicit and opt-in. All dynamic code runs at request time by default.

### Page-Level Caching
```tsx
// app/posts/page.tsx
"use cache"

export default async function PostsPage() {
  // This entire page is cached
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return <PostList posts={posts} />;
}
```

### Function-Level Caching
```tsx
// lib/cache/timeline.ts
export async function getCachedTimeline(userId: string) {
  "use cache"
  return db.timeline.findUnique({ where: { userId } });
}

export async function getCachedStats() {
  "use cache"
  return db.stats.aggregate();
}
```

### Cache Control with `cacheLife` and `cacheTag`
```tsx
import { cacheLife, cacheTag } from 'next/cache';

async function getUserProfile(userId: string) {
  "use cache"
  cacheLife('hours');  // Cache for hours instead of default
  cacheTag(`user-${userId}`);  // Tag for targeted revalidation
  
  return db.user.findUnique({ where: { id: userId } });
}
```

### Revalidation
```tsx
// Server Action
"use server"

import { revalidateTag } from 'next/cache';

export async function updateProfile(userId: string, data: ProfileData) {
  await db.user.update({ where: { id: userId }, data });
  revalidateTag(`user-${userId}`);
}
```

## 3. Component Composition Patterns

### Keep SC and CC in Separate Files
```tsx
// components/server/TimelineData.tsx (Server)
import { InteractiveControls } from '../client/InteractiveControls';

export async function TimelineData({ userId }) {
  const data = await fetchTimeline(userId);
  
  return (
    <div>
      <h1>Your Timeline</h1>
      <InteractiveControls initialData={data} />
    </div>
  );
}

// components/client/InteractiveControls.tsx (Client)
"use client";

export function InteractiveControls({ initialData }) {
  const [filter, setFilter] = useState('all');
  // ... interactive logic
}
```

### Passing Server Data to Client Components
```tsx
// Server Component
export default async function Page() {
  const events = await getEvents(); // Server-side fetch
  
  return (
    <ClientTimeline 
      events={events}  // Serializable data only
    />
  );
}
```

**Do NOT pass:**
- Functions (unless using Server Actions)
- Class instances
- Symbols
- Non-serializable objects

## 4. Context Providers

Context must be in Client Components. Minimize their scope.

```tsx
// providers/ThemeProvider.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

### Provider Placement in Layout
```tsx
// app/layout.tsx
import { ThemeProvider } from '@/providers/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## 5. Data Fetching Patterns

### Parallel Data Fetching
```tsx
export default async function DashboardPage() {
  // Fetch in parallel, not waterfall
  const [user, timeline, stats] = await Promise.all([
    getUser(),
    getTimeline(),
    getStats(),
  ]);
  
  return (
    <Dashboard user={user} timeline={timeline} stats={stats} />
  );
}
```

### Streaming with Suspense
```tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Fast content renders immediately */}
      <QuickStats />
      
      {/* Slow content streams in */}
      <Suspense fallback={<TimelineSkeleton />}>
        <SlowTimeline />
      </Suspense>
    </div>
  );
}

async function SlowTimeline() {
  const data = await fetchExpensiveData(); // Takes time
  return <Timeline data={data} />;
}
```

### Loading States
```tsx
// app/timeline/loading.tsx
export default function Loading() {
  return <TimelineSkeleton />;
}
```

## 6. Server Actions

```tsx
// app/actions/timeline.ts
"use server"

import { revalidatePath } from 'next/cache';

export async function addTimelineEvent(formData: FormData) {
  const title = formData.get('title') as string;
  const date = formData.get('date') as string;
  
  await db.timelineEvent.create({
    data: { title, date: new Date(date) },
  });
  
  revalidatePath('/timeline');
}
```

### Using in Client Components
```tsx
"use client";

import { addTimelineEvent } from '@/app/actions/timeline';
import { useActionState } from 'react';

export function AddEventForm() {
  const [state, action, isPending] = useActionState(addTimelineEvent, null);
  
  return (
    <form action={action}>
      <input name="title" required />
      <input name="date" type="date" required />
      <button disabled={isPending}>
        {isPending ? 'Adding...' : 'Add Event'}
      </button>
    </form>
  );
}
```

## 7. React 19.2 Features

### View Transitions
```tsx
"use client";

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function AnimatedLink({ href, children }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  const handleClick = (e) => {
    e.preventDefault();
    
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        startTransition(() => {
          router.push(href);
        });
      });
    } else {
      router.push(href);
    }
  };
  
  return <a href={href} onClick={handleClick}>{children}</a>;
}
```

### useEffectEvent (Extract Non-Reactive Logic)
```tsx
"use client";

import { useEffect, useEffectEvent } from 'react';

function ChatRoom({ roomId, onMessage }) {
  // This callback won't cause Effect to re-run when onMessage changes
  const handleMessage = useEffectEvent((message) => {
    onMessage(message);
  });
  
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('message', handleMessage);
    return () => connection.disconnect();
  }, [roomId]); // onMessage not needed in deps
}
```

## 8. React Compiler (Automatic Memoization)

Enabled via `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  reactCompiler: true,  // Stable in Next.js 16
};
```

**When enabled:**
- No need for manual `useMemo`, `useCallback`, `React.memo` in most cases
- Compiler automatically memoizes components and values
- Still use manual memoization for expensive computations if needed

## 9. Performance Best Practices

### 1. Minimize Client Components
Push interactivity to the leaves of your component tree.

### 2. Use Streaming
Return immediate content, stream slow parts.

### 3. Colocate Data Fetching
Fetch data in the component that needs it, not in parents.

### 4. Leverage Turbopack Caching
File system cache is on by default—restart dev server to see benefits.

### 5. Optimize Images
```tsx
import Image from 'next/image';

export function Avatar({ src, name }) {
  return (
    <Image
      src={src}
      alt={name}
      width={48}
      height={48}
      className="rounded-full"
      priority={false}
    />
  );
}
```

## 10. UI/Design Best Practices

Follow the **frontend-design skill** for distinctive interfaces. Key integration points with Next.js 16:

### Server vs Client for Design Elements

| Element | Component Type | Rationale |
|---------|---------------|-----------|
| Typography, colors, layout | Server | Static, no JS needed |
| SVG illustrations, icons | Server | Can be inlined, no hydration |
| CSS animations (keyframes) | Server | Pure CSS, no client JS |
| Hover/focus states | Server | CSS handles via `:hover`, `:focus` |
| Scroll-triggered animations | Client | Requires Intersection Observer |
| Complex motion sequences | Client | Requires Motion/GSAP |
| Interactive carousels/sliders | Client | User input handling |
| Theme toggles | Client | State management |

### Font Loading Strategy
```tsx
// app/layout.tsx - always use next/font for optimization
import localFont from 'next/font/local';

const displayFont = localFont({
  src: '../fonts/CustomDisplay.woff2',
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

// Avoid: loading fonts via CSS @import or <link> tags
// Avoid: generic fonts (Inter, Roboto, system-ui)
```

### Animation Performance Rules

1. **Prefer CSS over JS** — CSS animations don't require hydration
2. **Use `will-change` sparingly** — only for complex transforms
3. **Animate `transform` and `opacity` only** — avoids layout thrashing
4. **Stagger strategically** — one orchestrated page load > scattered micro-interactions

```css
/* High-performance animation */
.card {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.card:hover {
  transform: translateY(-4px) scale(1.02);
}

/* Avoid: animating width, height, margin, padding */
```

### Color System with Tailwind 4.x
```css
@theme {
  /* Define semantic tokens, not just raw colors */
  --color-surface-primary: oklch(0.98 0.01 280);
  --color-surface-elevated: oklch(1 0 0);
  --color-text-primary: oklch(0.15 0.02 280);
  --color-text-muted: oklch(0.45 0.02 280);
  --color-accent: oklch(0.6 0.2 25);
  --color-accent-hover: oklch(0.55 0.22 25);
}
```

### Avoiding "AI Slop" Aesthetics

❌ **Don't:**
- Use purple gradients on white backgrounds
- Default to Inter/Roboto/system fonts
- Apply uniform border-radius everywhere
- Use predictable card layouts
- Add gratuitous glassmorphism

✅ **Do:**
- Commit to a bold, specific aesthetic direction
- Choose distinctive, context-appropriate fonts
- Use asymmetry and unexpected spatial composition
- Create atmosphere with textures, shadows, grain
- Make one memorable design choice per component

## 11. Anti-Patterns to Avoid

❌ **Don't use `getServerSideProps` or `getStaticProps`** — These are Pages Router patterns. Use async Server Components instead.

❌ **Don't wrap entire app in Client Component** — This defeats Server Component benefits.

❌ **Don't fetch in useEffect when Server Component works** — Prefer server-side data fetching.

❌ **Don't pass non-serializable props to Client Components** — Only JSON-serializable data crosses the server/client boundary.

❌ **Don't rely on implicit caching** — Use `"use cache"` explicitly when you want caching.

## References

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching)
- [Server Actions](https://nextjs.org/docs/app/guides/server-actions)
