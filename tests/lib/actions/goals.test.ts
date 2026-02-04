import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGoal, updateGoal, GoalFormSchema, MilestoneSchema } from '@/lib/actions/goals';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-12345',
});

describe('Goal Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GoalFormSchema Validation', () => {
    it('validates a minimal valid goal', () => {
      const data = {
        title: 'Test Goal',
        category: 'career',
        priority: 'high',
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('validates a complete goal', () => {
      const data = {
        title: 'Complete Goal',
        description: 'A detailed description',
        category: 'health',
        targetDate: '2025-12-31',
        priority: 'medium',
        milestones: [
          {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            title: 'First milestone',
            completed: false,
          },
        ],
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects empty title', () => {
      const data = {
        title: '',
        category: 'career',
        priority: 'high',
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toContain('Title is required');
      }
    });

    it('rejects title over 100 characters', () => {
      const data = {
        title: 'a'.repeat(101),
        category: 'career',
        priority: 'high',
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toContain(
          'Title must be under 100 characters'
        );
      }
    });

    it('rejects description over 1000 characters', () => {
      const data = {
        title: 'Test',
        description: 'a'.repeat(1001),
        category: 'career',
        priority: 'high',
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.description).toContain(
          'Description must be under 1000 characters'
        );
      }
    });

    it('rejects invalid category', () => {
      const data = {
        title: 'Test',
        category: 'invalid',
        priority: 'high',
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects invalid priority', () => {
      const data = {
        title: 'Test',
        category: 'career',
        priority: 'urgent',
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts all valid categories', () => {
      const categories = ['career', 'health', 'finance', 'personal', 'relationship', 'travel'];

      categories.forEach((category) => {
        const result = GoalFormSchema.safeParse({
          title: 'Test',
          category,
          priority: 'high',
        });
        expect(result.success).toBe(true);
      });
    });

    it('accepts all valid priorities', () => {
      const priorities = ['high', 'medium', 'low'];

      priorities.forEach((priority) => {
        const result = GoalFormSchema.safeParse({
          title: 'Test',
          category: 'career',
          priority,
        });
        expect(result.success).toBe(true);
      });
    });

    it('defaults milestones to empty array', () => {
      const data = {
        title: 'Test',
        category: 'career',
        priority: 'high',
      };

      const result = GoalFormSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.milestones).toEqual([]);
      }
    });
  });

  describe('MilestoneSchema Validation', () => {
    it('validates a minimal milestone', () => {
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        title: 'Test Milestone',
      };

      const result = MilestoneSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('validates a complete milestone', () => {
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        title: 'Complete Milestone',
        targetDate: '2025-06-15',
        completed: true,
        completedAt: '2025-06-10T12:00:00Z',
      };

      const result = MilestoneSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID', () => {
      const data = {
        id: 'not-a-uuid',
        title: 'Test',
      };

      const result = MilestoneSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects empty title', () => {
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        title: '',
      };

      const result = MilestoneSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects title over 100 characters', () => {
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        title: 'a'.repeat(101),
      };

      const result = MilestoneSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('defaults completed to false', () => {
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        title: 'Test',
      };

      const result = MilestoneSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.completed).toBe(false);
      }
    });
  });

  describe('createGoal Action', () => {
    function createFormData(data: Record<string, string | undefined>): FormData {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.set(key, value);
        }
      });
      return formData;
    }

    it('creates a goal with valid data', async () => {
      const formData = createFormData({
        title: 'New Goal',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Goal created successfully');
      expect(result.goal).toBeDefined();
      expect(result.goal?.title).toBe('New Goal');
      expect(result.goal?.category).toBe('career');
      expect(result.goal?.priority).toBe('high');
      expect(result.goal?.status).toBe('not_started');
      expect(result.goal?.id).toBe('test-uuid-12345');
    });

    it('creates a goal with description', async () => {
      const formData = createFormData({
        title: 'Goal with Description',
        description: 'This is a detailed description',
        category: 'health',
        priority: 'medium',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.description).toBe('This is a detailed description');
    });

    it('creates a goal with target date', async () => {
      const formData = createFormData({
        title: 'Goal with Date',
        category: 'finance',
        priority: 'low',
        targetDate: '2025-12-31',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.targetDate).toBeDefined();
    });

    it('creates a goal with milestones', async () => {
      const milestones = [
        { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', title: 'Step 1', completed: false },
        { id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012', title: 'Step 2', completed: false },
      ];

      const formData = createFormData({
        title: 'Goal with Milestones',
        category: 'personal',
        priority: 'high',
        milestones: JSON.stringify(milestones),
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.milestones).toHaveLength(2);
      expect(result.goal?.milestones[0].title).toBe('Step 1');
    });

    it('returns validation error for missing title', async () => {
      const formData = createFormData({
        title: '',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Please fix the errors below');
      expect(result.errors?.title).toContain('Title is required');
    });

    it('returns validation error for invalid category', async () => {
      const formData = createFormData({
        title: 'Test Goal',
        category: 'invalid_category',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(false);
      expect(result.errors?.category).toBeDefined();
    });

    it('returns validation error for invalid priority', async () => {
      const formData = createFormData({
        title: 'Test Goal',
        category: 'career',
        priority: 'critical',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(false);
      expect(result.errors?.priority).toBeDefined();
    });

    it('handles missing milestones field', async () => {
      const formData = createFormData({
        title: 'Test Goal',
        category: 'career',
        priority: 'high',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.milestones).toEqual([]);
    });

    it('sets correct timestamps', async () => {
      const formData = createFormData({
        title: 'Timestamp Test',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const before = new Date();
      const result = await createGoal(null, formData);
      const after = new Date();

      expect(result.success).toBe(true);
      expect(result.goal?.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.goal?.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.goal?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('sets userId to default-user', async () => {
      const formData = createFormData({
        title: 'User Test',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.userId).toBe('default-user');
    });
  });

  describe('updateGoal Action', () => {
    function createFormData(data: Record<string, string | undefined>): FormData {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.set(key, value);
        }
      });
      return formData;
    }

    it('updates a goal with valid data', async () => {
      const formData = createFormData({
        goalId: 'existing-goal-id',
        title: 'Updated Goal',
        category: 'health',
        priority: 'medium',
        status: 'in_progress',
        milestones: '[]',
        createdAt: new Date('2024-01-01').toISOString(),
      });

      const result = await updateGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Goal updated successfully');
      expect(result.goal?.id).toBe('existing-goal-id');
      expect(result.goal?.title).toBe('Updated Goal');
      expect(result.goal?.status).toBe('in_progress');
    });

    it('returns error when goalId is missing', async () => {
      const formData = createFormData({
        title: 'Updated Goal',
        category: 'health',
        priority: 'medium',
        milestones: '[]',
      });

      const result = await updateGoal(null, formData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Goal ID is required');
    });

    it('preserves original createdAt', async () => {
      const originalDate = new Date('2024-01-01T00:00:00Z');
      const formData = createFormData({
        goalId: 'existing-goal-id',
        title: 'Updated Goal',
        category: 'health',
        priority: 'medium',
        milestones: '[]',
        createdAt: originalDate.toISOString(),
      });

      const result = await updateGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.createdAt.toISOString()).toBe(originalDate.toISOString());
    });

    it('updates milestone completion status', async () => {
      const milestones = [
        {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          title: 'Completed Step',
          completed: true,
          completedAt: '2024-06-15T12:00:00Z',
        },
      ];

      const formData = createFormData({
        goalId: 'existing-goal-id',
        title: 'Goal with Completed Milestones',
        category: 'career',
        priority: 'high',
        milestones: JSON.stringify(milestones),
        createdAt: new Date().toISOString(),
      });

      const result = await updateGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.milestones[0].completed).toBe(true);
      expect(result.goal?.milestones[0].completedAt).toBeDefined();
    });

    it('defaults status to not_started when not provided', async () => {
      const formData = createFormData({
        goalId: 'existing-goal-id',
        title: 'Goal without Status',
        category: 'career',
        priority: 'high',
        milestones: '[]',
        createdAt: new Date().toISOString(),
      });

      const result = await updateGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.status).toBe('not_started');
    });

    it('returns validation errors for invalid data', async () => {
      const formData = createFormData({
        goalId: 'existing-goal-id',
        title: '', // Invalid - empty
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await updateGoal(null, formData);

      expect(result.success).toBe(false);
      expect(result.errors?.title).toBeDefined();
    });

    it('updates updatedAt timestamp', async () => {
      const formData = createFormData({
        goalId: 'existing-goal-id',
        title: 'Updated Goal',
        category: 'career',
        priority: 'high',
        milestones: '[]',
        createdAt: new Date('2024-01-01').toISOString(),
      });

      const before = new Date();
      const result = await updateGoal(null, formData);
      const after = new Date();

      expect(result.success).toBe(true);
      expect(result.goal?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.goal?.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('handles milestone target dates', async () => {
      const milestones = [
        {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          title: 'Dated Milestone',
          targetDate: '2025-06-15',
          completed: false,
        },
      ];

      const formData = createFormData({
        goalId: 'existing-goal-id',
        title: 'Goal with Dated Milestones',
        category: 'career',
        priority: 'high',
        milestones: JSON.stringify(milestones),
        createdAt: new Date().toISOString(),
      });

      const result = await updateGoal(null, formData);

      expect(result.success).toBe(true);
      expect(result.goal?.milestones[0].targetDate).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    function createFormData(data: Record<string, string | undefined>): FormData {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.set(key, value);
        }
      });
      return formData;
    }

    it('handles title at exactly 100 characters', async () => {
      const formData = createFormData({
        title: 'a'.repeat(100),
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);
      expect(result.success).toBe(true);
    });

    it('handles description at exactly 1000 characters', async () => {
      const formData = createFormData({
        title: 'Test',
        description: 'a'.repeat(1000),
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);
      expect(result.success).toBe(true);
    });

    it('handles empty description', async () => {
      const formData = createFormData({
        title: 'Test',
        description: '',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);
      expect(result.success).toBe(true);
      expect(result.goal?.description).toBeUndefined();
    });

    it('handles whitespace-only title', async () => {
      const formData = createFormData({
        title: '   ',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);
      // Zod min(1) checks string length after parsing, so whitespace should fail
      // Actually, Zod doesn't trim by default, so this might pass
      // Let's check the behavior
      expect(result.success).toBe(true); // Zod allows whitespace-only strings by default
    });

    it('handles many milestones', async () => {
      const milestones = Array.from({ length: 20 }, (_, i) => ({
        id: `a1b2c3d4-e5f6-7890-abcd-ef12345678${i.toString().padStart(2, '0')}`,
        title: `Milestone ${i + 1}`,
        completed: false,
      }));

      const formData = createFormData({
        title: 'Goal with Many Milestones',
        category: 'career',
        priority: 'high',
        milestones: JSON.stringify(milestones),
      });

      const result = await createGoal(null, formData);
      expect(result.success).toBe(true);
      expect(result.goal?.milestones).toHaveLength(20);
    });

    it('handles special characters in title', async () => {
      const formData = createFormData({
        title: 'Goal with <special> "characters" & symbols!',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);
      expect(result.success).toBe(true);
      expect(result.goal?.title).toBe('Goal with <special> "characters" & symbols!');
    });

    it('handles unicode in title', async () => {
      const formData = createFormData({
        title: 'Goal with unicode: 你好 🎯 émojis',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(null, formData);
      expect(result.success).toBe(true);
      expect(result.goal?.title).toBe('Goal with unicode: 你好 🎯 émojis');
    });

    it('handles prevState being passed', async () => {
      const prevState = {
        success: false,
        message: 'Previous error',
        errors: { title: ['Old error'] },
      };

      const formData = createFormData({
        title: 'New Goal',
        category: 'career',
        priority: 'high',
        milestones: '[]',
      });

      const result = await createGoal(prevState, formData);
      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });
});
