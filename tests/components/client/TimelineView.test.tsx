import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineView } from '@/components/client/TimelineView';
import type { TimelineEvent, UserProfile } from '@/types';

// Mock ResizeObserver
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal('ResizeObserver', mockResizeObserver);

// Mock canvas methods
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    roundRect: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

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
    description: 'Vacation in France',
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

describe('TimelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timelineEvents.getAll).mockResolvedValue([]);
    vi.mocked(userProfile.get).mockResolvedValue(undefined);
    vi.mocked(goals.getAll).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching data', () => {
      vi.mocked(timelineEvents.getAll).mockImplementation(() => new Promise(() => {}));
      vi.mocked(userProfile.get).mockImplementation(() => new Promise(() => {}));
      vi.mocked(goals.getAll).mockImplementation(() => new Promise(() => {}));

      render(<TimelineView />);

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no events', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue([]);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText(/Timeline Canvas/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Import data or add events/i)).toBeInTheDocument();
    });

    it('shows import button in empty state', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue([]);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /Import Data/i })).toBeInTheDocument();
      });
    });
  });

  describe('Page Structure', () => {
    it('renders page header', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Timeline' })).toBeInTheDocument();
      });
    });

    it('shows event count', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });
    });
  });

  describe('Layer Filtering', () => {
    it('renders all layer filter buttons', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Work/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Travel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Health/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Relationships/i })).toBeInTheDocument();
    });

    it('toggles layer visibility when clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Work/i })).toBeInTheDocument();
      });

      // Click to hide work layer
      await user.click(screen.getByRole('button', { name: /Work/i }));

      // Should show 3 of 4 events
      await waitFor(() => {
        expect(screen.getByText(/3 of 4 events/)).toBeInTheDocument();
      });
    });

    it('toggles all layers when All button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });

      // Find the "All" button in the Layers section
      const allButtons = screen.getAllByRole('button', { name: /^All$/i });
      const layerAllButton = allButtons[0]; // First "All" button is for layers

      // Click to hide all layers
      await user.click(layerAllButton);

      // Should show 0 of 4 events
      await waitFor(() => {
        expect(screen.getByText(/0 of 4 events/)).toBeInTheDocument();
      });

      // Click again to show all layers
      await user.click(layerAllButton);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });
    });
  });

  describe('Search Filtering', () => {
    it('renders search input', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
      });
    });

    it('filters events by search query', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'Paris');

      await waitFor(() => {
        expect(screen.getByText(/1 of 4 events/)).toBeInTheDocument();
      });
    });

    it('clears search when clear button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'Paris');

      await waitFor(() => {
        expect(screen.getByText(/1 of 4 events/)).toBeInTheDocument();
      });

      // Click clear button
      const clearButton = searchInput.parentElement?.querySelector('button');
      await user.click(clearButton!);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });
    });

    it('searches in description as well', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'France');

      await waitFor(() => {
        expect(screen.getByText(/1 of 4 events/)).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Filters', () => {
    it('shows filter toggle button', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument();
      });
    });

    it('expands advanced filters when toggle clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Filters/i }));

      // Should show source filters
      await waitFor(() => {
        expect(screen.getByText(/Sources:/i)).toBeInTheDocument();
      });

      // Should show date range filters
      expect(screen.getByText(/Date range:/i)).toBeInTheDocument();
    });

    it('filters by source', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });

      // Open advanced filters
      await user.click(screen.getByRole('button', { name: /Filters/i }));

      await waitFor(() => {
        expect(screen.getByText(/Sources:/i)).toBeInTheDocument();
      });

      // Find and click LinkedIn source button to disable it
      const linkedinButton = screen.getByRole('button', { name: /LinkedIn/i });
      await user.click(linkedinButton);

      await waitFor(() => {
        expect(screen.getByText(/3 of 4 events/)).toBeInTheDocument();
      });
    });

    it('filters by date range', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });

      // Open advanced filters
      await user.click(screen.getByRole('button', { name: /Filters/i }));

      await waitFor(() => {
        expect(screen.getByText(/Date range:/i)).toBeInTheDocument();
      });

      // Find date inputs
      const dateInputs = document.querySelectorAll('input[type="date"]');
      const startDateInput = dateInputs[0] as HTMLInputElement;

      // Set start date to 2024
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      // Should only show events from 2024 (2 events)
      await waitFor(() => {
        expect(screen.getByText(/2 of 4 events/)).toBeInTheDocument();
      });
    });
  });

  describe('Clear Filters', () => {
    it('shows clear all button when filters are active', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'job');

      await waitFor(() => {
        expect(screen.getByText(/Clear all/i)).toBeInTheDocument();
      });
    });

    it('clears all filters when Clear all clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
      });

      // Apply search filter
      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'job');

      await waitFor(() => {
        expect(screen.getByText(/1 of 4 events/)).toBeInTheDocument();
      });

      // Clear all filters
      await user.click(screen.getByText(/Clear all/i));

      await waitFor(() => {
        expect(screen.getByText(/4 of 4 events/)).toBeInTheDocument();
      });
    });

    it('shows filter count badge when filters are active', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
      });

      // Apply search filter
      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'job');

      // Should show badge with count on Filters button
      await waitFor(() => {
        const filtersButton = screen.getByRole('button', { name: /Filters/i });
        // Badge should exist with some number (search filter + possibly source filter mismatch)
        expect(filtersButton.querySelector('span')).toBeInTheDocument();
      });

      // Clear the search
      await user.clear(searchInput);

      // Hide one layer to create a filter
      await user.click(screen.getByRole('button', { name: /Work/i }));

      // Should still show badge
      await waitFor(() => {
        const filtersButton = screen.getByRole('button', { name: /Filters/i });
        expect(filtersButton.querySelector('span')).toBeInTheDocument();
      });
    });
  });

  describe('No Results State', () => {
    it('shows no results message when filters exclude all events', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
      });

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'nonexistent event xyz');

      await waitFor(() => {
        expect(screen.getByText(/No events match your filters/i)).toBeInTheDocument();
      });
    });

    it('shows clear filters button in no results state', async () => {
      const user = userEvent.setup();
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
      });

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText(/Search events/i);
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
      });
    });
  });

  describe('Stats Row', () => {
    it('shows total events count', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText('Total Events')).toBeInTheDocument();
      });
    });

    it('shows work events count', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText('Career Milestones')).toBeInTheDocument();
      });
    });

    it('shows travel events count', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText('Places Visited')).toBeInTheDocument();
      });
    });
  });

  describe('Event Detail Modal', () => {
    it('modal is not shown initially', async () => {
      vi.mocked(timelineEvents.getAll).mockResolvedValue(mockEvents);

      render(<TimelineView />);

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      // Modal should not be visible
      expect(screen.queryByText('Started new job')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles database error gracefully', async () => {
      vi.mocked(timelineEvents.getAll).mockRejectedValue(new Error('DB Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<TimelineView />);

      // Should not crash and show empty state
      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load timeline data:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
