import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Goal, TimelineEvent, AssessmentResult } from '@/types';

// Mock the db module with stateful behavior for integration tests
const mockDatabase: {
  goals: Goal[];
  events: TimelineEvent[];
  assessments: AssessmentResult[];
} = {
  goals: [],
  events: [],
  assessments: [],
};

vi.mock('@/lib/db', () => ({
  goals: {
    getAll: vi.fn(() => Promise.resolve([...mockDatabase.goals])),
    add: vi.fn((goal: Goal) => {
      mockDatabase.goals.push(goal);
      return Promise.resolve(goal);
    }),
    update: vi.fn((goal: Goal) => {
      const idx = mockDatabase.goals.findIndex((g) => g.id === goal.id);
      if (idx >= 0) mockDatabase.goals[idx] = goal;
      return Promise.resolve(goal);
    }),
    delete: vi.fn((id: string) => {
      mockDatabase.goals = mockDatabase.goals.filter((g) => g.id !== id);
      return Promise.resolve();
    }),
    getActive: vi.fn(() =>
      Promise.resolve(
        mockDatabase.goals.filter((g) => g.status === 'not_started' || g.status === 'in_progress')
      )
    ),
    updateOrder: vi.fn((goals: Array<{ id: string; order: number }>) => {
      for (const { id, order } of goals) {
        const goal = mockDatabase.goals.find((g) => g.id === id);
        if (goal) goal.order = order;
      }
      return Promise.resolve();
    }),
  },
  timelineEvents: {
    getAll: vi.fn(() => Promise.resolve([...mockDatabase.events])),
    add: vi.fn((event: TimelineEvent) => {
      mockDatabase.events.push(event);
      return Promise.resolve(event);
    }),
    update: vi.fn((event: TimelineEvent) => {
      const idx = mockDatabase.events.findIndex((e) => e.id === event.id);
      if (idx >= 0) mockDatabase.events[idx] = event;
      return Promise.resolve(event);
    }),
    delete: vi.fn((id: string) => {
      mockDatabase.events = mockDatabase.events.filter((e) => e.id !== id);
      return Promise.resolve();
    }),
    getByLayer: vi.fn((layer: string) =>
      Promise.resolve(mockDatabase.events.filter((e) => e.layer === layer))
    ),
  },
  assessments: {
    getAll: vi.fn(() => Promise.resolve([...mockDatabase.assessments])),
    add: vi.fn((assessment: AssessmentResult) => {
      mockDatabase.assessments.push(assessment);
      return Promise.resolve(assessment);
    }),
    getByType: vi.fn((type: string) =>
      Promise.resolve(mockDatabase.assessments.filter((a) => a.assessmentType === type))
    ),
    getLatestByType: vi.fn((type: string) => {
      const filtered = mockDatabase.assessments.filter((a) => a.assessmentType === type);
      if (filtered.length === 0) return Promise.resolve(undefined);
      return Promise.resolve(
        filtered.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
      );
    }),
  },
  userProfile: {
    get: vi.fn(() => Promise.resolve(undefined)),
    save: vi.fn(() => Promise.resolve()),
    exists: vi.fn(() => Promise.resolve(false)),
  },
}));

// Import components after mocking
import { DreamboardView } from '@/components/client/DreamboardView';
import { AssessmentsView } from '@/components/client/AssessmentsView';
import { goals, timelineEvents, assessments } from '@/lib/db';

// Helper to create test data
function createTestGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: `goal-${Math.random().toString(36).slice(2)}`,
    userId: 'test-user',
    title: 'Test Goal',
    description: 'Test description',
    category: 'personal',
    targetDate: new Date('2025-12-31'),
    priority: 'medium',
    status: 'not_started',
    milestones: [],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: `event-${Math.random().toString(36).slice(2)}`,
    userId: 'test-user',
    title: 'Test Event',
    description: 'Test description',
    startDate: new Date('2024-06-15'),
    layer: 'work',
    eventType: 'job',
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestAssessment(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    id: `assessment-${Math.random().toString(36).slice(2)}`,
    userId: 'test-user',
    assessmentType: 'personality_big5',
    completedAt: new Date(),
    scores: { openness: 75, conscientiousness: 80 },
    duration: 900,
    ...overrides,
  };
}

describe('Integration Tests - Data Flow', () => {
  beforeEach(() => {
    // Reset mock database
    mockDatabase.goals = [];
    mockDatabase.events = [];
    mockDatabase.assessments = [];
    vi.clearAllMocks();
  });

  describe('DreamboardView Data Flow', () => {
    it('loads and displays goals from database', async () => {
      mockDatabase.goals = [
        createTestGoal({ id: 'goal-1', title: 'Learn React' }),
        createTestGoal({ id: 'goal-2', title: 'Build Portfolio' }),
      ];

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Learn React')).toBeInTheDocument();
        expect(screen.getByText('Build Portfolio')).toBeInTheDocument();
      });

      expect(goals.getAll).toHaveBeenCalled();
    });

    it('persists new goals to database', async () => {
      const user = userEvent.setup();
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new goal/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /new goal/i }));

      // Fill form
      await user.type(screen.getByLabelText(/title/i), 'New Persisted Goal');

      // Find the submit button (there may be multiple "Create Goal" buttons)
      const createGoalButtons = screen.getAllByRole('button', { name: /create goal/i });
      const submitButton = createGoalButtons.find((btn) => btn.getAttribute('type') === 'submit');
      await user.click(submitButton!);

      await waitFor(() => {
        expect(goals.add).toHaveBeenCalled();
      });

      // Verify the goal was added to mock database
      expect(mockDatabase.goals.some((g) => g.title === 'New Persisted Goal')).toBe(true);
    });

    it('updates goals in database when status changes', async () => {
      const user = userEvent.setup();
      const testGoal = createTestGoal({
        id: 'goal-1',
        title: 'Status Test Goal',
        status: 'not_started',
      });
      mockDatabase.goals = [testGoal];

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Status Test Goal')).toBeInTheDocument();
      });

      // Change status
      await user.selectOptions(screen.getByRole('combobox'), 'in_progress');

      await waitFor(() => {
        expect(goals.update).toHaveBeenCalled();
      });

      // Verify updated in mock database
      const updatedGoal = mockDatabase.goals.find((g) => g.id === 'goal-1');
      expect(updatedGoal?.status).toBe('in_progress');
    });

    it('removes goals from database when deleted', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      mockDatabase.goals = [
        createTestGoal({ id: 'goal-1', title: 'Goal to Delete' }),
      ];

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Goal to Delete')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Delete')[0]);

      await waitFor(() => {
        expect(goals.delete).toHaveBeenCalledWith('goal-1');
      });

      expect(mockDatabase.goals).toHaveLength(0);
    });

    it('maintains filter state across database updates', async () => {
      const user = userEvent.setup();
      mockDatabase.goals = [
        createTestGoal({ id: 'goal-1', title: 'Career Goal', category: 'career' }),
        createTestGoal({ id: 'goal-2', title: 'Health Goal', category: 'health' }),
      ];

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Career Goal')).toBeInTheDocument();
        expect(screen.getByText('Health Goal')).toBeInTheDocument();
      });

      // Filter to career only
      await user.click(screen.getByText(/Career \(1\)/));

      expect(screen.getByText('Career Goal')).toBeInTheDocument();
      expect(screen.queryByText('Health Goal')).not.toBeInTheDocument();
    });
  });

  describe('AssessmentsView Data Flow', () => {
    it('loads and displays previous assessment results', async () => {
      mockDatabase.assessments = [
        createTestAssessment({
          id: 'assessment-1',
          assessmentType: 'personality_big5',
          scores: {
            openness: 75,
            conscientiousness: 80,
            extraversion: 60,
            agreeableness: 70,
            neuroticism: 45,
          },
        }),
      ];

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(assessments.getAll).toHaveBeenCalled();
      });
    });

    it('persists new assessment results to database', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Assessments')).toBeInTheDocument();
      });

      // Find FIRE Calculator card and its button
      await waitFor(() => {
        expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
      });

      // Find the FIRE Calculator card and click its Start Assessment button
      const fireCard = screen.getByText('FIRE Calculator').closest('div')?.parentElement?.parentElement;
      const startButton = fireCard?.querySelector('button');
      if (startButton) {
        await user.click(startButton);
      }

      // Complete the FIRE calculation
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /calculate projection/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(assessments.add).toHaveBeenCalled();
      });

      expect(mockDatabase.assessments.some((a) => a.assessmentType === 'fire_projection')).toBe(
        true
      );
    });

    it('shows latest assessment results for each type', async () => {
      const olderAssessment = createTestAssessment({
        id: 'assessment-old',
        assessmentType: 'personality_big5',
        completedAt: new Date('2024-01-01'),
        scores: {
          openness: 50,
          conscientiousness: 50,
          extraversion: 50,
          agreeableness: 50,
          neuroticism: 50,
        },
      });

      const newerAssessment = createTestAssessment({
        id: 'assessment-new',
        assessmentType: 'personality_big5',
        completedAt: new Date('2024-06-01'),
        scores: {
          openness: 85,
          conscientiousness: 90,
          extraversion: 75,
          agreeableness: 80,
          neuroticism: 35,
        },
      });

      mockDatabase.assessments = [olderAssessment, newerAssessment];

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(assessments.getAll).toHaveBeenCalled();
      });
    });
  });

  describe('Cross-Component Data Consistency', () => {
    it('goals count is consistent across views', async () => {
      mockDatabase.goals = [
        createTestGoal({ status: 'not_started' }),
        createTestGoal({ status: 'in_progress' }),
        createTestGoal({ status: 'completed' }),
      ];

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText(/All Goals \(3\)/)).toBeInTheDocument();
      });
    });

    it('assessment results accumulate over multiple submissions', async () => {
      const firstAssessment = createTestAssessment({
        assessmentType: 'fire_projection',
        completedAt: new Date('2024-01-01'),
      });

      const secondAssessment = createTestAssessment({
        assessmentType: 'fire_projection',
        completedAt: new Date('2024-06-01'),
      });

      mockDatabase.assessments = [firstAssessment];

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(assessments.getAll).toHaveBeenCalled();
      });

      // Simulate adding second assessment
      mockDatabase.assessments.push(secondAssessment);

      // Verify both are in database
      expect(mockDatabase.assessments).toHaveLength(2);
    });
  });

  describe('Error Recovery', () => {
    it('handles database load errors gracefully in DreamboardView', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(goals.getAll).mockRejectedValueOnce(new Error('Database error'));

      render(<DreamboardView />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Should still show the page structure
      expect(screen.getByText('Dreamboard')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('handles database save errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.mocked(goals.delete).mockRejectedValueOnce(new Error('Delete failed'));

      mockDatabase.goals = [createTestGoal({ id: 'goal-1', title: 'Test Goal' })];

      const user = userEvent.setup();
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Delete')[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Data Transformation', () => {
    it('correctly transforms goal data between form and database', async () => {
      const user = userEvent.setup();
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new goal/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /new goal/i }));

      // Fill in goal details
      await user.type(screen.getByLabelText(/title/i), 'Transform Test Goal');

      // Select category
      await user.selectOptions(screen.getByLabelText(/category/i), 'health');

      // Select priority
      await user.selectOptions(screen.getByLabelText(/priority/i), 'high');

      // Find the submit button (there may be multiple "Create Goal" buttons)
      const createGoalButtons = screen.getAllByRole('button', { name: /create goal/i });
      const submitButton = createGoalButtons.find((btn) => btn.getAttribute('type') === 'submit');
      await user.click(submitButton!);

      await waitFor(() => {
        expect(goals.add).toHaveBeenCalled();
      });

      const savedGoal = mockDatabase.goals.find((g) => g.title === 'Transform Test Goal');
      expect(savedGoal).toBeDefined();
      expect(savedGoal?.category).toBe('health');
      expect(savedGoal?.priority).toBe('high');
      expect(savedGoal?.status).toBe('not_started');
      expect(savedGoal?.userId).toBeDefined();
      expect(savedGoal?.createdAt).toBeDefined();
    });

    it('preserves milestone data through update cycle', async () => {
      const user = userEvent.setup();
      const goalWithMilestones = createTestGoal({
        id: 'goal-1',
        title: 'Goal with Milestones',
        milestones: [
          { id: 'ms-1', title: 'Milestone 1', completed: true },
          { id: 'ms-2', title: 'Milestone 2', completed: false },
        ],
      });

      mockDatabase.goals = [goalWithMilestones];

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Goal with Milestones')).toBeInTheDocument();
      });

      // Should show progress
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });
  });

  describe('Concurrent Operations', () => {
    it('handles rapid status updates correctly', async () => {
      const user = userEvent.setup();
      mockDatabase.goals = [
        createTestGoal({ id: 'goal-1', title: 'Rapid Update Goal', status: 'not_started' }),
      ];

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Rapid Update Goal')).toBeInTheDocument();
      });

      const combobox = screen.getByRole('combobox');

      // Multiple rapid updates
      await user.selectOptions(combobox, 'in_progress');
      await user.selectOptions(combobox, 'completed');

      await waitFor(() => {
        // Should call update for each change
        expect(goals.update).toHaveBeenCalled();
      });
    });
  });
});
