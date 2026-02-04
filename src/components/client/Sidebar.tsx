'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { timelineEvents, userProfile, goals } from '@/lib/db';
import type { UserProfile, Goal } from '@/types';
import { createAbortController, composeCleanup } from '@/lib/utils/asyncCleanup';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: 'timeline',
    label: 'Timeline',
    href: '/timeline',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'insights',
    label: 'Insights',
    href: '/insights',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'dreamboard',
    label: 'Dreamboard',
    href: '/dreamboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    id: 'coach',
    label: 'AI Coach',
    href: '/coach',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

const secondaryNavItems: NavItem[] = [
  {
    id: 'import',
    label: 'Import Data',
    href: '/import',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: 'assessments',
    label: 'Assessments',
    href: '/assessments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [goalStats, setGoalStats] = useState<{ total: number; completed: number; active: number }>({
    total: 0,
    completed: 0,
    active: 0,
  });
  const pathname = usePathname();

  // Track if a load is currently in progress to prevent overlapping loads
  const isLoadingRef = useRef(false);

  // Load user data with proper cancellation support
  useEffect(() => {
    const { isAborted, cleanup: abortCleanup } = createAbortController();

    const loadData = async () => {
      // Prevent overlapping loads
      if (isLoadingRef.current || isAborted()) return;
      isLoadingRef.current = true;

      try {
        const [profileData, count, allGoals] = await Promise.all([
          userProfile.get(),
          timelineEvents.count(),
          goals.getAll(),
        ]);

        // Check if component was unmounted during async operation
        if (isAborted()) return;

        setProfile(profileData ?? null);
        setEventCount(count);

        // Calculate goal stats
        const completed = allGoals.filter((g: Goal) => g.status === 'completed').length;
        const active = allGoals.filter((g: Goal) => g.status === 'in_progress' || g.status === 'not_started').length;
        setGoalStats({ total: allGoals.length, completed, active });
      } catch (error) {
        // Don't log errors if component was unmounted
        if (!isAborted()) {
          console.error('Failed to load sidebar data:', error);
        }
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadData();

    // Refresh data periodically to stay in sync
    const interval = setInterval(loadData, 5000);

    // Compose cleanup: abort controller + clear interval
    return composeCleanup(abortCleanup, () => clearInterval(interval));
  }, []);

  // Calculate life progress
  const lifeProgress = profile?.birthDate
    ? (() => {
        const birthDate = new Date(profile.birthDate);
        const now = new Date();
        const ageInMs = now.getTime() - birthDate.getTime();
        const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);
        const lifeExpectancy = profile.lifeExpectancy || 85;
        const percentLived = Math.min(100, (ageInYears / lifeExpectancy) * 100);
        const yearsRemaining = Math.max(0, lifeExpectancy - ageInYears);
        const weeksRemaining = Math.floor(yearsRemaining * 52);
        return {
          age: Math.floor(ageInYears),
          lifeExpectancy,
          percentLived,
          yearsRemaining: Math.floor(yearsRemaining),
          weeksRemaining,
        };
      })()
    : null;

  // Calculate goal completion rate
  const goalCompletionRate = goalStats.total > 0
    ? Math.round((goalStats.completed / goalStats.total) * 100)
    : 0;

  // Calculate year progress
  const yearProgress = (() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
    const elapsed = now.getTime() - startOfYear.getTime();
    const total = endOfYear.getTime() - startOfYear.getTime();
    return Math.round((elapsed / total) * 100);
  })();

  const userName = profile?.name || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 h-screen
        bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-subtle)]
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--color-border-subtle)]">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-primary)] flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-bg-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                Timeline
              </span>
            </Link>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-primary)] flex items-center justify-center mx-auto">
              <svg className="w-5 h-5 text-[var(--color-bg-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`
              p-1.5 rounded-md text-[var(--color-text-muted)]
              hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]
              transition-colors
              ${collapsed ? 'mx-auto mt-2' : ''}
            `}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Life Progress (when expanded) */}
        {!collapsed && (
          <div className="px-4 py-4 border-b border-[var(--color-border-subtle)]">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Life Progress
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--color-text-secondary)]">Age</span>
                  <span className="text-[var(--color-accent-primary)]">
                    {lifeProgress
                      ? `${lifeProgress.age} / ${lifeProgress.lifeExpectancy}`
                      : '-- / --'}
                  </span>
                </div>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${lifeProgress?.percentLived || 0}%` }}
                  />
                </div>
              </div>
              {lifeProgress && (
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{lifeProgress.weeksRemaining.toLocaleString()} weeks left</span>
                  <span>{lifeProgress.yearsRemaining} years</span>
                </div>
              )}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--color-text-secondary)]">
                    {new Date().getFullYear()}
                  </span>
                  <span className="text-[var(--color-accent-primary)]">{yearProgress}%</span>
                </div>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${yearProgress}%` }} />
                </div>
              </div>
              {goalStats.total > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--color-text-secondary)]">Goals</span>
                    <span className="text-[var(--color-accent-secondary)]">
                      {goalStats.completed}/{goalStats.total}
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-bar bg-[var(--color-accent-secondary)]"
                      style={{ width: `${goalCompletionRate}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          <div className={`${collapsed ? '' : 'px-2'} mb-2`}>
            {!collapsed && (
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Main
              </span>
            )}
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200
                  ${collapsed ? 'justify-center' : ''}
                  ${
                    isActive
                      ? 'bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}

          <div className={`${collapsed ? '' : 'px-2'} mt-6 mb-2`}>
            {!collapsed && (
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Tools
              </span>
            )}
          </div>
          {secondaryNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200
                  ${collapsed ? 'justify-center' : ''}
                  ${
                    isActive
                      ? 'bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-[var(--color-border-subtle)] p-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-9 h-9 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-[var(--color-accent-primary)] font-medium">
              {userInitial}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {userName}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {eventCount.toLocaleString()} events
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
