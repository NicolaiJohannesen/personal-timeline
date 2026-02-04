import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '@/components/client/Sidebar';
import type { UserProfile, Goal } from '@/types';

const mockProfile: UserProfile = {
  id: 'default-user',
  name: 'Alice Johnson',
  birthDate: new Date('1992-03-15'),
  country: 'us',
  lifeExpectancy: 90,
  createdAt: new Date(),
  updatedAt: new Date(),
  settings: {
    theme: 'dark',
    defaultView: 'timeline',
    sidebarCollapsed: false,
    notifications: {
      goalReminders: true,
      milestoneAlerts: true,
      coachingPrompts: false,
    },
  },
};

const mockGoals: Goal[] = [
  {
    id: 'goal-1',
    userId: 'default-user',
    title: 'Learn Spanish',
    category: 'personal',
    priority: 'medium',
    status: 'completed',
    milestones: [],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'goal-2',
    userId: 'default-user',
    title: 'Run Marathon',
    category: 'health',
    priority: 'high',
    status: 'in_progress',
    milestones: [],
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'goal-3',
    userId: 'default-user',
    title: 'Write Book',
    category: 'personal',
    priority: 'low',
    status: 'not_started',
    milestones: [],
    order: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock the database
vi.mock('@/lib/db', () => ({
  userProfile: {
    get: vi.fn(),
  },
  timelineEvents: {
    count: vi.fn(),
  },
  goals: {
    getAll: vi.fn(),
  },
}));

import { userProfile, timelineEvents, goals } from '@/lib/db';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks - always resolve immediately
    vi.mocked(userProfile.get).mockResolvedValue(undefined);
    vi.mocked(timelineEvents.count).mockResolvedValue(0);
    vi.mocked(goals.getAll).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navigation', () => {
    it('renders all main navigation items', async () => {
      render(<Sidebar />);

      // Use getAllByText for Timeline since it appears in both branding and nav
      expect(screen.getAllByText('Timeline').length).toBeGreaterThan(0);
      expect(screen.getByText('Insights')).toBeInTheDocument();
      expect(screen.getByText('Dreamboard')).toBeInTheDocument();
      expect(screen.getByText('AI Coach')).toBeInTheDocument();
    });

    it('renders all tool navigation items', async () => {
      render(<Sidebar />);

      expect(screen.getByText('Import Data')).toBeInTheDocument();
      expect(screen.getByText('Assessments')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('has correct href for timeline link', () => {
      render(<Sidebar />);

      // Get the navigation link specifically (not the branding)
      const nav = screen.getByRole('navigation');
      const timelineLink = nav.querySelector('a[href="/timeline"]');
      expect(timelineLink).toBeInTheDocument();
    });

    it('has correct href for insights link', () => {
      render(<Sidebar />);

      const insightsLink = screen.getByText('Insights').closest('a');
      expect(insightsLink).toHaveAttribute('href', '/insights');
    });

    it('has correct href for import link', () => {
      render(<Sidebar />);

      const importLink = screen.getByText('Import Data').closest('a');
      expect(importLink).toHaveAttribute('href', '/import');
    });
  });

  describe('Branding', () => {
    it('shows app logo and name', () => {
      render(<Sidebar />);

      // Timeline appears in both branding and nav
      expect(screen.getAllByText('Timeline').length).toBeGreaterThan(0);
    });

    it('logo links to home page', () => {
      render(<Sidebar />);

      // Find the link wrapping the logo
      const homeLinks = screen.getAllByRole('link');
      const homeLink = homeLinks.find((link) => link.getAttribute('href') === '/');
      expect(homeLink).toBeInTheDocument();
    });
  });

  describe('Collapse/Expand', () => {
    it('renders collapse button', () => {
      render(<Sidebar />);

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      expect(collapseButton).toBeInTheDocument();
    });

    it('collapses sidebar when button clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      // When collapsed, sidebar should have collapsed width
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toContain('w-16');
    });

    it('expands sidebar when expand button clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      // First collapse
      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      // Then expand
      const expandButton = screen.getByRole('button', { name: /expand sidebar/i });
      await user.click(expandButton);

      // Should be expanded again
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toContain('w-64');
    });

    it('hides labels when collapsed', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      // Labels should not be visible (they're still in DOM but hidden)
      // The nav items should show tooltips instead
      const timelineLinks = screen.getAllByTitle('Timeline');
      expect(timelineLinks.length).toBeGreaterThan(0);
    });
  });

  describe('User Section', () => {
    it('shows default user when no profile', async () => {
      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument();
      });
    });

    it('shows user initial', async () => {
      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('U')).toBeInTheDocument();
      });
    });

    it('shows user name from profile', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });
    });

    it('shows user initial from profile name', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('A')).toBeInTheDocument();
      });
    });

    it('shows event count', async () => {
      vi.mocked(timelineEvents.count).mockResolvedValue(250);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('250 events')).toBeInTheDocument();
      });
    });

    it('formats large event counts with locale', async () => {
      vi.mocked(timelineEvents.count).mockResolvedValue(1500);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('1,500 events')).toBeInTheDocument();
      });
    });
  });

  describe('Life Progress Section', () => {
    it('shows placeholder when no profile', async () => {
      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('-- / --')).toBeInTheDocument();
      });
    });

    it('shows life progress from profile', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('Life Progress')).toBeInTheDocument();
      });

      // Should show age / life expectancy
      // Profile has lifeExpectancy of 90
      await waitFor(() => {
        expect(screen.getByText(/\d+ \/ 90/)).toBeInTheDocument();
      });
    });

    it('shows year progress', () => {
      render(<Sidebar />);

      // Current year should be displayed
      const currentYear = new Date().getFullYear();
      expect(screen.getByText(String(currentYear))).toBeInTheDocument();
    });

    it('hides life progress when collapsed', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      expect(screen.queryByText('Life Progress')).not.toBeInTheDocument();
    });
  });

  describe('Section Labels', () => {
    it('shows Main section label', () => {
      render(<Sidebar />);

      expect(screen.getByText('Main')).toBeInTheDocument();
    });

    it('shows Tools section label', () => {
      render(<Sidebar />);

      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('hides section labels when collapsed', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      expect(screen.queryByText('Main')).not.toBeInTheDocument();
      expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('highlights timeline link when on timeline page', () => {
      // usePathname is mocked to return '/timeline' in setup.ts
      render(<Sidebar />);

      // Get the navigation link specifically (not the branding)
      const nav = screen.getByRole('navigation');
      const timelineLink = nav.querySelector('a[href="/timeline"]');
      expect(timelineLink?.className).toContain('text-[var(--color-accent-primary)]');
    });
  });

  describe('Data Loading', () => {
    it('loads data on mount', async () => {
      render(<Sidebar />);

      // Data should be loaded
      await waitFor(() => {
        expect(userProfile.get).toHaveBeenCalled();
        expect(timelineEvents.count).toHaveBeenCalled();
      });
    });

    it('cleans up interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { unmount } = render(<Sidebar />);

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles profile load error gracefully', async () => {
      vi.mocked(userProfile.get).mockRejectedValue(new Error('Load failed'));
      vi.mocked(timelineEvents.count).mockResolvedValue(0);

      // Should not throw
      render(<Sidebar />);

      // Wait for error to be caught
      await waitFor(() => {
        // Should still render with default values
        expect(screen.getByText('User')).toBeInTheDocument();
      });
    });

    it('handles event count error gracefully', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(undefined);
      vi.mocked(timelineEvents.count).mockRejectedValue(new Error('Count failed'));

      render(<Sidebar />);

      await waitFor(() => {
        // Should still render with default count
        expect(screen.getByText('0 events')).toBeInTheDocument();
      });
    });
  });

  describe('Goal Progress', () => {
    it('loads goals on mount', async () => {
      render(<Sidebar />);

      await waitFor(() => {
        expect(goals.getAll).toHaveBeenCalled();
      });
    });

    it('shows goal completion progress when goals exist', async () => {
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('Goals')).toBeInTheDocument();
      });

      // 1 completed out of 3 total
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('does not show goal progress when no goals', async () => {
      vi.mocked(goals.getAll).mockResolvedValue([]);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('Life Progress')).toBeInTheDocument();
      });

      expect(screen.queryByText('Goals')).not.toBeInTheDocument();
    });

    it('handles goals load error gracefully', async () => {
      vi.mocked(goals.getAll).mockRejectedValue(new Error('Goals failed'));

      // Should not throw
      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument();
      });
    });
  });

  describe('Weeks Remaining', () => {
    it('shows weeks remaining when profile has birthDate', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText(/weeks left/)).toBeInTheDocument();
      });
    });

    it('shows years remaining when profile has birthDate', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText(/\d+ years/)).toBeInTheDocument();
      });
    });

    it('does not show weeks remaining when no profile', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(undefined);

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText('-- / --')).toBeInTheDocument();
      });

      expect(screen.queryByText(/weeks left/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has complementary role', () => {
      render(<Sidebar />);

      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('has navigation role', () => {
      render(<Sidebar />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has accessible collapse button', () => {
      render(<Sidebar />);

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      expect(collapseButton).toHaveAttribute('aria-label');
    });
  });
});
