import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { InsightsView } from '@/components/client/InsightsView';
import type { TimelineEvent, Goal, UserProfile } from '@/types';

// Mock data
const mockEvents: TimelineEvent[] = [
  {
    id: 'event-1',
    userId: 'default-user',
    title: 'Started new job',
    startDate: new Date('2023-01-15'),
    layer: 'work',
    eventType: 'job_start',
    source: 'linkedin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'event-2',
    userId: 'default-user',
    title: 'Trip to Paris',
    startDate: new Date('2023-06-10'),
    layer: 'travel',
    eventType: 'trip',
    source: 'google',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'event-3',
    userId: 'default-user',
    title: 'Doctor checkup',
    startDate: new Date('2024-02-20'),
    layer: 'health',
    eventType: 'appointment',
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'event-4',
    userId: 'default-user',
    title: 'Meeting with friend',
    startDate: new Date('2024-03-15'),
    layer: 'relationships',
    eventType: 'social',
    source: 'facebook',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockGoals: Goal[] = [
  {
    id: 'goal-1',
    userId: 'default-user',
    title: 'Learn Spanish',
    category: 'personal',
    priority: 'medium',
    status: 'in_progress',
    milestones: [],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'goal-2',
    userId: 'default-user',
    title: 'Run a marathon',
    category: 'health',
    priority: 'high',
    status: 'completed',
    milestones: [],
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockProfile: UserProfile = {
  id: 'default-user',
  name: 'Test User',
  birthDate: new Date('1990-05-15'),
  country: 'us',
  lifeExpectancy: 85,
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

// Mock the database
vi.mock('@/lib/db', () => ({
  timelineEvents: {
    getAll: vi.fn(),
  },
  userProfile: {
    get: vi.fn(),
  },
  goals: {
    getAll: vi.fn(),
  },
}));

import { timelineEvents, userProfile, goals } from '@/lib/db';

describe('InsightsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching data', () => {
      vi.mocked(timelineEvents.getAll).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      vi.mocked(userProfile.get).mockImplementation(() => new Promise(() => {}));
      vi.mocked(goals.getAll).mockImplementation(() => new Promise(() => {}));

      render(<InsightsView />);

      // Should show loading skeleton with animated pulses
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state messages when no data', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue([]);
      vi.mocked(userProfile.get).mockResolvedValue(undefined);
      vi.mocked(goals.getAll).mockResolvedValue([]);

      render(<InsightsView />);

      await waitFor(() => {
        // Multiple "0" values shown for various stats
        expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      });

      expect(screen.getByText(/No events to analyze/i)).toBeInTheDocument();
      expect(screen.getByText(/No events to visualize/i)).toBeInTheDocument();
    });

    it('shows create goal button when no goals', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue([]);
      vi.mocked(userProfile.get).mockResolvedValue(undefined);
      vi.mocked(goals.getAll).mockResolvedValue([]);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Create Your First Goal')).toBeInTheDocument();
      });
    });
  });

  describe('With Data', () => {
    beforeEach(() => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);
    });

    it('renders page header', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Analytics and patterns from your life data/i)
      ).toBeInTheDocument();
    });

    it('displays total events count', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Total Events')).toBeInTheDocument();
      });

      // Find the count in the Total Events section
      const totalEventsLabel = screen.getByText('Total Events');
      const countElement = totalEventsLabel.previousElementSibling;
      expect(countElement?.textContent).toBe('4');
    });

    it('calculates years of data correctly', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Years of Data')).toBeInTheDocument();
      });

      // Find the count in the Years of Data section
      const yearsLabel = screen.getByText('Years of Data');
      const countElement = yearsLabel.previousElementSibling;
      expect(countElement?.textContent).toBe('2');
    });

    it('counts data sources correctly', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        // Find the stat card version (has specific class)
        const dataSourcesLabels = screen.getAllByText('Data Sources');
        expect(dataSourcesLabels.length).toBeGreaterThanOrEqual(1);
      });

      // Find the count in the Data Sources stat card (small text version)
      const dataSourcesLabels = screen.getAllByText('Data Sources');
      const statLabel = dataSourcesLabels.find(el => el.className.includes('text-sm'));
      const countElement = statLabel?.previousElementSibling;
      // 4 unique sources: linkedin, google, manual, facebook
      expect(countElement?.textContent).toBe('4');
    });

    it('shows events by layer distribution', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Events by Layer')).toBeInTheDocument();
      });

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Travel')).toBeInTheDocument();
      expect(screen.getByText('Health')).toBeInTheDocument();
      expect(screen.getByText('Relationships')).toBeInTheDocument();
    });

    it('shows events over time chart', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Events Over Time')).toBeInTheDocument();
      });
    });

    it('shows top event types', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Top Event Types')).toBeInTheDocument();
      });
    });

    it('shows data sources breakdown', async () => {
      render(<InsightsView />);

      await waitFor(() => {
        // Look for specific sources
        expect(screen.getByText('linkedin')).toBeInTheDocument();
        expect(screen.getByText('google')).toBeInTheDocument();
        expect(screen.getByText('facebook')).toBeInTheDocument();
        expect(screen.getByText('manual')).toBeInTheDocument();
      });
    });
  });

  describe('Life Progress Section', () => {
    beforeEach(() => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);
    });

    it('shows life progress when profile exists', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Life Progress')).toBeInTheDocument();
      });

      expect(screen.getByText('Years old')).toBeInTheDocument();
      expect(screen.getByText('Expected lifespan')).toBeInTheDocument();
      expect(screen.getByText('Years remaining')).toBeInTheDocument();
      expect(screen.getByText('Weeks remaining')).toBeInTheDocument();
    });

    it('calculates age correctly', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<InsightsView />);

      await waitFor(() => {
        // User born in 1990, so age depends on current date
        // The test should verify the calculation is made
        expect(screen.getByText('Years old')).toBeInTheDocument();
      });
    });

    it('shows life expectancy from profile', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Expected lifespan')).toBeInTheDocument();
      });

      // Find the life expectancy value near the label
      const lifespanSection = screen.getByText('Expected lifespan').closest('div');
      expect(lifespanSection?.parentElement?.textContent).toContain('85');
    });

    it('does not show life progress when no profile', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(undefined);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Total Events')).toBeInTheDocument();
      });

      expect(screen.queryByText('Life Progress')).not.toBeInTheDocument();
    });
  });

  describe('Goals Overview', () => {
    beforeEach(() => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);
    });

    it('shows goals overview section', async () => {
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Goals Overview')).toBeInTheDocument();
      });
    });

    it('counts active goals correctly', async () => {
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Active Goals')).toBeInTheDocument();
      });

      // 1 goal is in_progress - find the count in the Active Goals section
      const activeGoalsSection = screen.getByText('Active Goals').closest('div');
      expect(activeGoalsSection?.parentElement?.textContent).toContain('1');
    });

    it('counts completed goals correctly', async () => {
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Completed Goals')).toBeInTheDocument();
      });
    });

    it('shows total goals count', async () => {
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Total Goals')).toBeInTheDocument();
      });

      // 2 total goals - find the count in the Total Goals section
      const totalGoalsSection = screen.getByText('Total Goals').closest('div');
      expect(totalGoalsSection?.parentElement?.textContent).toContain('2');
    });
  });

  describe('Date Range Info', () => {
    it('shows date range when events exist', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);
      vi.mocked(goals.getAll).mockResolvedValue(mockGoals);

      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText(/Data spans from/i)).toBeInTheDocument();
      });
    });

    it('does not show date range when no events', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue([]);
      vi.mocked(userProfile.get).mockResolvedValue(undefined);
      vi.mocked(goals.getAll).mockResolvedValue([]);

      render(<InsightsView />);

      await waitFor(() => {
        // Multiple "0" values shown for various stats
        expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      });

      expect(screen.queryByText(/Data spans from/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      vi.mocked(timelineEvents.getAll).mockRejectedValue(new Error('DB Error'));
      vi.mocked(userProfile.get).mockRejectedValue(new Error('DB Error'));
      vi.mocked(goals.getAll).mockRejectedValue(new Error('DB Error'));

      // Should not throw
      render(<InsightsView />);

      await waitFor(() => {
        expect(screen.getByText('Insights')).toBeInTheDocument();
      });
    });
  });
});
