# Next.js 16.x Project Structure and Features

*Updated: February 2026*

## 1. Project Setup

### Technologies
- Next.js 16.1.x
- TypeScript 5.9.x
- Tailwind CSS 4.1.x
- React 19.2.x
- Node.js 22.x LTS or 24.x LTS
- Docker
- AWS/Azure/GCP (multi-cloud deployment)
- GitHub (version control)

### Directory Structure
```
lifemap-app/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── app/
│   ├── api/
│   │   └── [...]/route.ts
│   ├── (routes)/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── components/
│   │   ├── server/
│   │   └── client/
│   ├── lib/
│   │   ├── actions/          # Server Actions
│   │   └── cache/            # Cache utilities
│   ├── styles/
│   │   └── globals.css       # Tailwind 4.x CSS-first config
│   └── utils/
├── public/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .dockerignore
├── .env.local
├── .gitignore
├── Dockerfile
├── next.config.ts            # Native TypeScript config
├── package.json
├── README.md
└── tsconfig.json
```

**Key changes from 14.x:**
- `next.config.ts` replaces `next.config.js` (native TS support)
- No `tailwind.config.js` needed (Tailwind 4.x CSS-first configuration)
- No `postcss.config.js` needed (Tailwind 4.x handles this internally)
- `eslint.config.js` replaces `.eslintrc.json` (ESLint 9 flat config)

## 2. Key Features and Components

### 2.1 Turbopack (Stable, Default)
- Turbopack is now the default bundler for both `next dev` and `next build`
- File system caching enabled by default for faster incremental builds
- No `--turbopack` flag needed

```json
// package.json - simplified scripts
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

### 2.2 Cache Components and `use cache`
- New explicit caching model replaces implicit App Router caching
- All dynamic code runs at request time by default
- Opt-in caching with `"use cache"` directive

```tsx
// app/posts/page.tsx
"use cache"

export default async function PostsPage() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return <PostList posts={posts} />;
}
```

```tsx
// Granular function-level caching
async function getUser(id: string) {
  "use cache"
  return db.user.findUnique({ where: { id } });
}
```

### 2.3 Server and Client Components
- Server components remain the default
- Client components require `"use client"` directive
- React Compiler (stable) provides automatic memoization

```tsx
// Server Component (default)
export default async function ServerComponent() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// Client Component
"use client";

import { useState } from 'react';

export default function ClientComponent() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
```

### 2.4 React 19.2 Features
- **View Transitions**: Animate elements during navigation
- **useEffectEvent**: Extract non-reactive logic from Effects
- **Activity**: Render background UI with `display: none` while maintaining state

```tsx
"use client";

import { useTransition, startViewTransition } from 'react';

export function NavigationLink({ href, children }) {
  return (
    <Link 
      href={href}
      onClick={(e) => {
        if (document.startViewTransition) {
          e.preventDefault();
          document.startViewTransition(() => router.push(href));
        }
      }}
    >
      {children}
    </Link>
  );
}
```

### 2.5 Enhanced Routing
- Layout deduplication: shared layouts downloaded once
- Incremental prefetching: only prefetches parts not in cache
- Optimized navigation with reduced transfer sizes

### 2.6 API Routes and Route Handlers
```ts
// app/api/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  const timeline = await getTimeline(userId);
  return NextResponse.json(timeline);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const entry = await createTimelineEntry(data);
  return NextResponse.json(entry, { status: 201 });
}
```

### 2.7 Middleware and Proxy
- `middleware.ts` for request interception
- New `proxy.ts` for clearer network boundary handling

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

### 2.8 Tailwind CSS 4.x Integration
CSS-first configuration in `globals.css`:

```css
/* app/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.7 0.15 200);
  --color-secondary: oklch(0.6 0.1 250);
  --font-sans: InterVariable, sans-serif;
  --breakpoint-3xl: 1920px;
}

@layer base {
  html {
    @apply antialiased;
  }
}
```

### 2.9 SEO and Metadata
```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | LifeMap',
    default: 'LifeMap - Navigate Your Personal Life Journey',
  },
  description: 'Visualize and plan your personal life timeline',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'LifeMap',
  },
};
```

### 2.10 Error Handling
```tsx
// app/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

## 3. Development Practices

### 3.1 TypeScript 5.9.x
- Strict mode enabled by default via `tsc --init`
- `import defer` for deferred module evaluation
- Expandable hovers in VS Code

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3.2 Testing
- **Vitest**: Preferred for unit testing (faster than Jest)
- **React Testing Library**: Component testing
- **Playwright**: E2E testing (recommended over Cypress for Next.js)

### 3.3 Code Quality
- ESLint 9 with flat config
- Prettier or Biome for formatting
- TypeScript strict mode

### 3.4 CI/CD with GitHub Actions
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

## 4. Deployment

### 4.1 Build Adapters API
Next.js 16 introduces Build Adapters for custom deployment integrations:

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Custom adapter for non-Vercel deployments
  experimental: {
    adapterPath: require.resolve('./deploy-adapter.js'),
  },
};

export default nextConfig;
```

### 4.2 Docker Configuration
```dockerfile
# Dockerfile
FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### 4.3 Standalone Output
```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
};
```

## 5. Security

- Keep dependencies updated (critical RSC vulnerabilities patched in 16.1.x)
- Use environment variables for secrets
- Implement CSP headers via middleware
- Enable HTTPS in production
- Use `next/headers` for secure cookie handling

## 6. Performance

- Turbopack provides 5-10x faster dev builds
- React Compiler reduces re-renders automatically
- `"use cache"` for explicit, predictable caching
- Image optimization via `next/image`
- Font optimization via `next/font`

## 7. UI/Design Integration

### Design Philosophy
UI development follows the **frontend-design skill** for distinctive, production-grade interfaces that avoid generic "AI slop" aesthetics. Key principles:

- **Bold aesthetic direction**: Commit to a clear visual identity (brutalist, luxury, editorial, retro-futuristic, etc.)
- **Distinctive typography**: Avoid generic fonts (Inter, Roboto, Arial); use characterful display + refined body font pairings
- **Intentional color**: Dominant colors with sharp accents over timid, evenly-distributed palettes
- **Purposeful motion**: High-impact animations at key moments, not scattered micro-interactions

### Design + Next.js 16 Architecture

| Design Element | Implementation Location | Notes |
|----------------|------------------------|-------|
| Custom fonts | `next/font` in layout.tsx | Optimized loading, no layout shift |
| CSS variables/theming | `globals.css` @theme block | Tailwind 4.x CSS-first config |
| Static decorative elements | Server Components | SVGs, backgrounds, typography |
| Interactive animations | Client Components | Motion library, hover states |
| Scroll-triggered effects | Client Components | Intersection Observer, scroll handlers |
| Complex backgrounds | CSS only | Gradient meshes, noise textures |

### Font Configuration with next/font
```tsx
// app/layout.tsx
import { Playfair_Display, Source_Sans_3 } from 'next/font/google';

const displayFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const bodyFont = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

### Tailwind 4.x Theme Integration
```css
/* app/styles/globals.css */
@import "tailwindcss";

@theme {
  /* Typography */
  --font-display: var(--font-display), serif;
  --font-body: var(--font-body), sans-serif;
  
  /* Color palette - commit to bold choices */
  --color-primary: oklch(0.45 0.2 265);      /* Deep violet */
  --color-accent: oklch(0.75 0.18 85);       /* Warm gold */
  --color-surface: oklch(0.12 0.02 280);     /* Near-black with subtle hue */
  --color-text: oklch(0.95 0.01 280);        /* Off-white */
  
  /* Spacing for generous negative space */
  --spacing-section: 8rem;
  --spacing-element: 2rem;
}

@layer base {
  html {
    @apply antialiased;
    font-feature-settings: 'kern' 1, 'liga' 1;
  }
  
  h1, h2, h3 {
    font-family: var(--font-display);
    letter-spacing: -0.02em;
  }
  
  body {
    font-family: var(--font-body);
  }
}
```

### Animation Strategy
```tsx
// components/client/AnimatedSection.tsx
"use client";

import { motion } from 'framer-motion';

// High-impact staggered reveal for page load
export function AnimatedSection({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.8, 
        delay,
        ease: [0.22, 1, 0.36, 1] // Custom easing
      }}
    >
      {children}
    </motion.div>
  );
}
```

### Directory Structure for Design System
```
app/
├── components/
│   ├── server/
│   │   └── StaticHero.tsx       # Non-interactive visual elements
│   └── client/
│       ├── AnimatedSection.tsx   # Motion components
│       └── InteractiveCard.tsx   # Hover/click interactions
├── styles/
│   ├── globals.css               # Theme, fonts, base styles
│   └── animations.css            # Keyframes, transitions
└── lib/
    └── design-tokens.ts          # Exported constants if needed
```

## 8. Migration from 14.x

Use the automated upgrade tool:
```bash
npx @next/codemod@canary upgrade latest
```

Or manually:
```bash
npm install next@latest react@latest react-dom@latest
npm install -D @types/react@latest @types/react-dom@latest
```

Key breaking changes:
- Turbopack default (add `--webpack` flag to opt out)
- Async request APIs (`params`, `searchParams` are now async)
- `next/image` defaults changed
- Cache behavior is now opt-in via `"use cache"`
