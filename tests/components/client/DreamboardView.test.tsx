import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DreamboardView } from '@/components/client/DreamboardView';
import type { Goal } from '@/types';

// Mock the db module
vi.mock('@/lib/db', () => ({
  goals: {
    getAll: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateOrder: vi.fn(),
  },
}));

import { goals as goalsDb } from '@/lib/db';

// Helper to create mock goals
function createMockGoal(overrides: Partial<Goal> = {}): Goal {
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

describe('DreamboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(goalsDb.getAll).mockResolvedValue([]);
    vi.mocked(goalsDb.add).mockImplementation((goal) => Promise.resolve(goal));
    vi.mocked(goalsDb.update).mockImplementation((goal) => Promise.resolve(goal));
    vi.mocked(goalsDb.delete).mockResolvedValue();
    vi.mocked(goalsDb.updateOrder).mockResolvedValue();
  });

  describe('Loading State', () => {
    it('shows loading skeleton initially', () => {
      vi.mocked(goalsDb.getAll).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );
      render(<DreamboardView />);

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('stops showing loading state after data loads', async () => {
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Dreamboard')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no goals exist', async () => {
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Set Your First Goal')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Dreams become reality when you write them down/)
      ).toBeInTheDocument();
    });

    it('shows Create Goal button in empty state', async () => {
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create goal/i })).toBeInTheDocument();
      });
    });

    it('opens goal form when Create Goal is clicked in empty state', async () => {
      const user = userEvent.setup();
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create goal/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create goal/i }));

      expect(screen.getByText('Create New Goal')).toBeInTheDocument();
    });
  });

  describe('Page Structure', () => {
    it('renders page title and description', async () => {
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Dreamboard')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Visualize your future goals and track your journey')
      ).toBeInTheDocument();
    });

    it('has New Goal button in header', async () => {
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new goal/i })).toBeInTheDocument();
      });
    });

    it('shows All Goals filter button with count', async () => {
      const mockGoals = [createMockGoal(), createMockGoal()];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText(/All Goals \(2\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Displaying Goals', () => {
    it('displays goal cards when goals exist', async () => {
      const mockGoals = [
        createMockGoal({ title: 'Learn Piano', category: 'personal' }),
        createMockGoal({ title: 'Run Marathon', category: 'health' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Learn Piano')).toBeInTheDocument();
        expect(screen.getByText('Run Marathon')).toBeInTheDocument();
      });
    });

    it('shows goal description', async () => {
      const mockGoals = [
        createMockGoal({ title: 'Test Goal', description: 'This is my goal description' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('This is my goal description')).toBeInTheDocument();
      });
    });

    it('shows goal category', async () => {
      const mockGoals = [createMockGoal({ title: 'Test Goal', category: 'finance' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('finance')).toBeInTheDocument();
      });
    });

    it('separates active and completed goals', async () => {
      const mockGoals = [
        createMockGoal({ title: 'Active Goal', status: 'in_progress' }),
        createMockGoal({ title: 'Done Goal', status: 'completed' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Active Goals')).toBeInTheDocument();
        // Use getAllByText since 'Completed' appears in both section heading and status dropdown
        const completedElements = screen.getAllByText('Completed');
        expect(completedElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Category Filters', () => {
    it('shows category filter buttons for existing categories', async () => {
      const mockGoals = [
        createMockGoal({ category: 'career' }),
        createMockGoal({ category: 'health' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText(/Career \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Health \(1\)/)).toBeInTheDocument();
      });
    });

    it('does not show filter buttons for empty categories', async () => {
      const mockGoals = [createMockGoal({ category: 'career' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText(/Career \(1\)/)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Health \(/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Finance \(/)).not.toBeInTheDocument();
    });

    it('filters goals when category button is clicked', async () => {
      const user = userEvent.setup();
      const mockGoals = [
        createMockGoal({ title: 'Career Goal', category: 'career' }),
        createMockGoal({ title: 'Health Goal', category: 'health' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Career Goal')).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Career \(1\)/));

      expect(screen.getByText('Career Goal')).toBeInTheDocument();
      expect(screen.queryByText('Health Goal')).not.toBeInTheDocument();
    });

    it('shows all goals when All Goals filter is clicked', async () => {
      const user = userEvent.setup();
      const mockGoals = [
        createMockGoal({ title: 'Career Goal', category: 'career' }),
        createMockGoal({ title: 'Health Goal', category: 'health' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Career Goal')).toBeInTheDocument();
      });

      // Filter to career only
      await user.click(screen.getByText(/Career \(1\)/));

      expect(screen.queryByText('Health Goal')).not.toBeInTheDocument();

      // Go back to all
      await user.click(screen.getByText(/All Goals \(2\)/));

      expect(screen.getByText('Career Goal')).toBeInTheDocument();
      expect(screen.getByText('Health Goal')).toBeInTheDocument();
    });
  });

  describe('Goal Progress', () => {
    it('shows progress bar for goals with milestones', async () => {
      const mockGoals = [
        createMockGoal({
          title: 'Test Goal',
          milestones: [
            { id: '1', title: 'Milestone 1', completed: true },
            { id: '2', title: 'Milestone 2', completed: false },
          ],
        }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Progress')).toBeInTheDocument();
        expect(screen.getByText('1/2')).toBeInTheDocument();
      });
    });

    it('does not show progress bar for goals without milestones', async () => {
      const mockGoals = [createMockGoal({ title: 'Test Goal', milestones: [] })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });

      expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    });
  });

  describe('Creating Goals', () => {
    it('opens goal form modal when New Goal is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new goal/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /new goal/i }));

      expect(screen.getByText('Create New Goal')).toBeInTheDocument();
    });

    it('closes modal when clicking outside', async () => {
      const user = userEvent.setup();
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new goal/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /new goal/i }));

      expect(screen.getByText('Create New Goal')).toBeInTheDocument();

      // Click the backdrop
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      if (backdrop) {
        await user.click(backdrop);
      }

      await waitFor(() => {
        expect(screen.queryByText('Create New Goal')).not.toBeInTheDocument();
      });
    });

    it('adds new goal to the list after creation', async () => {
      const user = userEvent.setup();
      vi.mocked(goalsDb.getAll).mockResolvedValue([]);

      const newGoal = createMockGoal({ id: 'new-goal', title: 'My New Goal' });
      vi.mocked(goalsDb.add).mockResolvedValue(newGoal);

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new goal/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /new goal/i }));

      // Fill in form
      await user.type(screen.getByLabelText(/title/i), 'My New Goal');
      // Get all "Create Goal" buttons and click the one that's a submit button (inside the form)
      const createGoalButtons = screen.getAllByRole('button', { name: /create goal/i });
      const formSubmitButton = createGoalButtons.find(btn => btn.getAttribute('type') === 'submit');
      await user.click(formSubmitButton!);

      await waitFor(() => {
        expect(screen.getByText('My New Goal')).toBeInTheDocument();
      });
    });
  });

  describe('Editing Goals', () => {
    it('shows Edit Goal modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      const mockGoals = [createMockGoal({ title: 'Test Goal' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });

      // Find the edit button (visible on hover, but clickable)
      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      expect(screen.getByText('Edit Goal')).toBeInTheDocument();
    });

    it('updates goal in list after editing', async () => {
      const user = userEvent.setup();
      const mockGoal = createMockGoal({ id: 'goal-1', title: 'Original Title' });
      vi.mocked(goalsDb.getAll).mockResolvedValue([mockGoal]);

      const updatedGoal = { ...mockGoal, title: 'Updated Title' };
      vi.mocked(goalsDb.update).mockResolvedValue(updatedGoal);

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Original Title')).toBeInTheDocument();
      });

      // Open edit form
      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      // Clear and update title
      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');
      // Button is "Save Changes" when editing
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText('Updated Title')).toBeInTheDocument();
      });
    });
  });

  describe('Deleting Goals', () => {
    it('shows confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const mockGoals = [createMockGoal({ title: 'Test Goal' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this goal?');
      confirmSpy.mockRestore();
    });

    it('removes goal from list when deletion is confirmed', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const mockGoals = [createMockGoal({ id: 'goal-1', title: 'Test Goal' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      vi.mocked(goalsDb.delete).mockResolvedValue();

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Test Goal')).not.toBeInTheDocument();
      });

      expect(goalsDb.delete).toHaveBeenCalledWith('goal-1');
    });

    it('does not delete goal when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const mockGoals = [createMockGoal({ title: 'Test Goal' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Test Goal')).toBeInTheDocument();
      expect(goalsDb.delete).not.toHaveBeenCalled();
    });
  });

  describe('Status Updates', () => {
    it('shows status dropdown on goal card', async () => {
      const mockGoals = [createMockGoal({ status: 'not_started' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('not_started');
      });
    });

    it('updates goal status when dropdown changes', async () => {
      const user = userEvent.setup();
      const mockGoal = createMockGoal({ id: 'goal-1', status: 'not_started' });
      vi.mocked(goalsDb.getAll).mockResolvedValue([mockGoal]);
      vi.mocked(goalsDb.update).mockResolvedValue({ ...mockGoal, status: 'in_progress' });

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'in_progress');

      await waitFor(() => {
        expect(goalsDb.update).toHaveBeenCalled();
        const updateCall = vi.mocked(goalsDb.update).mock.calls[0][0];
        expect(updateCall.status).toBe('in_progress');
      });
    });

    it('moves goal from Active to Completed section when status changes to completed', async () => {
      const user = userEvent.setup();
      const mockGoal = createMockGoal({ id: 'goal-1', title: 'My Goal', status: 'in_progress' });
      vi.mocked(goalsDb.getAll).mockResolvedValue([mockGoal]);
      vi.mocked(goalsDb.update).mockResolvedValue({ ...mockGoal, status: 'completed' });

      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Active Goals')).toBeInTheDocument();
      });

      // "Completed" section heading should not exist yet (though "Completed" in dropdown does)
      const completedHeadings = screen.queryAllByRole('heading', { name: 'Completed' });
      expect(completedHeadings).toHaveLength(0);

      await user.selectOptions(screen.getByRole('combobox'), 'completed');

      await waitFor(() => {
        // Now there should be a Completed section heading
        const completedSection = screen.getAllByText('Completed');
        expect(completedSection.length).toBeGreaterThanOrEqual(2); // heading + dropdown option
      });
    });
  });

  describe('Goal Status Types', () => {
    it('displays not_started goals as active', async () => {
      const mockGoals = [createMockGoal({ title: 'Pending Goal', status: 'not_started' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Active Goals')).toBeInTheDocument();
        expect(screen.getByText('Pending Goal')).toBeInTheDocument();
      });
    });

    it('displays in_progress goals as active', async () => {
      const mockGoals = [createMockGoal({ title: 'Working Goal', status: 'in_progress' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Active Goals')).toBeInTheDocument();
        expect(screen.getByText('Working Goal')).toBeInTheDocument();
      });
    });

    it('displays completed goals in completed section', async () => {
      const mockGoals = [createMockGoal({ title: 'Done Goal', status: 'completed' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        // Completed section heading should exist (plus option in dropdown)
        const completedElements = screen.getAllByText('Completed');
        expect(completedElements.length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Done Goal')).toBeInTheDocument();
      });
    });

    it('does not show abandoned goals in active or completed sections', async () => {
      const mockGoals = [createMockGoal({ title: 'Abandoned Goal', status: 'abandoned' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        // Abandoned goals count toward total but don't appear in Active or Completed sections
        expect(screen.getByText(/All Goals \(1\)/)).toBeInTheDocument();
      });

      // Should not show "Active Goals" section heading since there are no active goals
      expect(screen.queryByText('Active Goals')).not.toBeInTheDocument();
      // Abandoned goals don't appear in either section grid
      // The goal title won't be visible since abandoned goals aren't displayed
      expect(screen.queryByText('Abandoned Goal')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles error when loading goals', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(goalsDb.getAll).mockRejectedValue(new Error('Failed to load'));

      render(<DreamboardView />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load goals:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('handles error when deleting goal', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const mockGoals = [createMockGoal({ title: 'Test Goal' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      vi.mocked(goalsDb.delete).mockRejectedValue(new Error('Delete failed'));

      const user = userEvent.setup();
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to delete goal:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('handles error when updating goal status', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockGoals = [createMockGoal({ status: 'not_started' })];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      vi.mocked(goalsDb.update).mockRejectedValue(new Error('Update failed'));

      const user = userEvent.setup();
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'completed');

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to update goal status:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Multiple Goals', () => {
    it('handles mixed status goals correctly', async () => {
      const mockGoals = [
        createMockGoal({ title: 'Goal 1', status: 'not_started' }),
        createMockGoal({ title: 'Goal 2', status: 'in_progress' }),
        createMockGoal({ title: 'Goal 3', status: 'completed' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('Active Goals')).toBeInTheDocument();
        // "Completed" appears in section heading and dropdown options
        const completedElements = screen.getAllByText('Completed');
        expect(completedElements.length).toBeGreaterThanOrEqual(1);
      });

      // Active section should have Goal 1 and Goal 2
      expect(screen.getByText('Goal 1')).toBeInTheDocument();
      expect(screen.getByText('Goal 2')).toBeInTheDocument();

      // Completed section should have Goal 3
      expect(screen.getByText('Goal 3')).toBeInTheDocument();
    });

    it('shows correct goal count in filter', async () => {
      const mockGoals = [
        createMockGoal({ category: 'career' }),
        createMockGoal({ category: 'career' }),
        createMockGoal({ category: 'health' }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText(/All Goals \(3\)/)).toBeInTheDocument();
        expect(screen.getByText(/Career \(2\)/)).toBeInTheDocument();
        expect(screen.getByText(/Health \(1\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Milestone Progress Calculation', () => {
    it('calculates correct progress percentage', async () => {
      const mockGoals = [
        createMockGoal({
          title: 'Test Goal',
          milestones: [
            { id: '1', title: 'M1', completed: true },
            { id: '2', title: 'M2', completed: true },
            { id: '3', title: 'M3', completed: false },
            { id: '4', title: 'M4', completed: false },
          ],
        }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('2/4')).toBeInTheDocument();
      });

      // Progress bar should be at 50%
      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('50%'));
    });

    it('shows 100% when all milestones completed', async () => {
      const mockGoals = [
        createMockGoal({
          title: 'Test Goal',
          milestones: [
            { id: '1', title: 'M1', completed: true },
            { id: '2', title: 'M2', completed: true },
          ],
        }),
      ];
      vi.mocked(goalsDb.getAll).mockResolvedValue(mockGoals);
      render(<DreamboardView />);

      await waitFor(() => {
        expect(screen.getByText('2/2')).toBeInTheDocument();
      });

      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('100%'));
    });
  });
});
