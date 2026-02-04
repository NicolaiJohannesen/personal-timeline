import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalForm } from '@/components/client/GoalForm';
import type { Goal } from '@/types';

// Mock the goals database
vi.mock('@/lib/db', () => ({
  goals: {
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock server actions
vi.mock('@/lib/actions/goals', () => ({
  createGoal: vi.fn().mockImplementation(async (prevState, formData) => {
    const title = formData.get('title');
    if (!title) {
      return {
        success: false,
        message: 'Please fix the errors below',
        errors: { title: ['Title is required'] },
      };
    }
    return {
      success: true,
      message: 'Goal created successfully',
      goal: {
        id: 'new-goal-id',
        userId: 'default-user',
        title,
        category: formData.get('category'),
        priority: formData.get('priority'),
        status: 'not_started',
        milestones: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }),
  updateGoal: vi.fn().mockImplementation(async (prevState, formData) => {
    return {
      success: true,
      message: 'Goal updated successfully',
      goal: {
        id: formData.get('goalId'),
        userId: 'default-user',
        title: formData.get('title'),
        category: formData.get('category'),
        priority: formData.get('priority'),
        status: formData.get('status'),
        milestones: [],
        createdAt: new Date(formData.get('createdAt') as string),
        updatedAt: new Date(),
      },
    };
  }),
}));

const createTestGoal = (): Goal => ({
  id: 'test-goal-id',
  userId: 'test-user',
  title: 'Test Goal',
  description: 'Test description',
  category: 'career',
  priority: 'high',
  status: 'in_progress',
  milestones: [
    { id: 'ms-1', title: 'Milestone 1', completed: false },
    { id: 'ms-2', title: 'Milestone 2', completed: true, completedAt: new Date() },
  ],
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('GoalForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders create form with empty fields', () => {
      render(<GoalForm />);

      expect(screen.getByLabelText(/goal title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/target date/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create goal/i })).toBeInTheDocument();
    });

    it('renders edit form with existing goal data', () => {
      const goal = createTestGoal();
      render(<GoalForm goal={goal} />);

      expect(screen.getByDisplayValue('Test Goal')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('renders cancel button when onCancel is provided', () => {
      const onCancel = vi.fn();
      render(<GoalForm onCancel={onCancel} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('does not render cancel button when onCancel is not provided', () => {
      render(<GoalForm />);

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('Category Selection', () => {
    it('renders all category options', () => {
      render(<GoalForm />);

      const categorySelect = screen.getByLabelText(/category/i);
      expect(categorySelect).toBeInTheDocument();

      const options = categorySelect.querySelectorAll('option');
      expect(options).toHaveLength(6);

      expect(screen.getByRole('option', { name: 'Career' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Health' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Finance' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Personal' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Relationships' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Travel' })).toBeInTheDocument();
    });
  });

  describe('Priority Selection', () => {
    it('renders all priority options', () => {
      render(<GoalForm />);

      const prioritySelect = screen.getByLabelText(/priority/i);
      expect(prioritySelect).toBeInTheDocument();

      expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Medium' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Low' })).toBeInTheDocument();
    });
  });

  describe('Milestones', () => {
    it('renders existing milestones when editing', () => {
      const goal = createTestGoal();
      render(<GoalForm goal={goal} />);

      expect(screen.getByText('Milestone 1')).toBeInTheDocument();
      expect(screen.getByText('Milestone 2')).toBeInTheDocument();
    });

    it('adds a new milestone', async () => {
      const user = userEvent.setup();
      render(<GoalForm />);

      const input = screen.getByPlaceholderText(/add a milestone/i);
      await user.type(input, 'New Milestone');

      const addButton = screen.getByRole('button', { name: /add/i });
      await user.click(addButton);

      expect(screen.getByText('New Milestone')).toBeInTheDocument();
    });

    it('removes a milestone', async () => {
      const user = userEvent.setup();
      const goal = createTestGoal();
      render(<GoalForm goal={goal} />);

      // Find and click the first remove button
      const removeButtons = screen.getAllByRole('button', { name: /remove milestone/i });
      await user.click(removeButtons[0]);

      expect(screen.queryByText('Milestone 1')).not.toBeInTheDocument();
    });

    it('disables add button when input is empty', () => {
      render(<GoalForm />);

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton).toBeDisabled();
    });

    it('clears input after adding milestone', async () => {
      const user = userEvent.setup();
      render(<GoalForm />);

      const input = screen.getByPlaceholderText(/add a milestone/i);
      await user.type(input, 'New Milestone');
      await user.click(screen.getByRole('button', { name: /add/i }));

      expect(input).toHaveValue('');
    });
  });

  describe('Form Submission', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<GoalForm onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    it('has required attribute on title', () => {
      render(<GoalForm />);

      const titleInput = screen.getByLabelText(/goal title/i);
      expect(titleInput).toHaveAttribute('required');
    });

    it('has maxLength on title', () => {
      render(<GoalForm />);

      const titleInput = screen.getByLabelText(/goal title/i);
      expect(titleInput).toHaveAttribute('maxLength', '100');
    });

    it('has maxLength on description', () => {
      render(<GoalForm />);

      const descInput = screen.getByLabelText(/description/i);
      expect(descInput).toHaveAttribute('maxLength', '1000');
    });
  });
});
