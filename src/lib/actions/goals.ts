'use server';

import { z } from 'zod';
import type { Goal, GoalCategory, GoalPriority, GoalStatus, Milestone } from '@/types';

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json || typeof json !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely convert string to Date with validation
 */
function safeParseDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr || typeof dateStr !== 'string') {
    return undefined;
  }
  const date = new Date(dateStr);
  // Check if date is valid and within reasonable range (1900-2100)
  if (isNaN(date.getTime())) {
    return undefined;
  }
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    return undefined;
  }
  return date;
}

// Validation schemas
export const MilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Milestone title is required').max(100),
  targetDate: z.string().optional(),
  completed: z.boolean().default(false),
  completedAt: z.string().optional(),
});

export const GoalFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be under 100 characters'),
  description: z.string().max(1000, 'Description must be under 1000 characters').optional(),
  category: z.enum(['career', 'health', 'finance', 'personal', 'relationship', 'travel'] as const),
  targetDate: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low'] as const),
  milestones: z.array(MilestoneSchema).default([]),
  order: z.number().int().min(0).optional(),
});

export type GoalFormData = z.infer<typeof GoalFormSchema>;

export type GoalFormState = {
  success: boolean;
  message: string;
  errors?: {
    title?: string[];
    description?: string[];
    category?: string[];
    targetDate?: string[];
    priority?: string[];
    milestones?: string[];
  };
  goal?: Goal;
};

/**
 * Create a new goal
 * Note: This action prepares the goal data. Actual storage happens client-side via IndexedDB.
 */
export async function createGoal(
  prevState: GoalFormState | null,
  formData: FormData
): Promise<GoalFormState> {
  // Extract form data with safe parsing
  const milestonesRaw = safeJsonParse<unknown[]>(
    formData.get('milestones') as string,
    []
  );

  const orderRaw = formData.get('order');
  const order = orderRaw ? parseInt(orderRaw as string, 10) : 0;

  const rawData = {
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    category: formData.get('category'),
    targetDate: formData.get('targetDate') || undefined,
    priority: formData.get('priority'),
    milestones: milestonesRaw,
    order: isNaN(order) ? 0 : order,
  };

  // Validate
  const result = GoalFormSchema.safeParse(rawData);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: {
        title: fieldErrors.title,
        description: fieldErrors.description,
        category: fieldErrors.category,
        targetDate: fieldErrors.targetDate,
        priority: fieldErrors.priority,
        milestones: fieldErrors.milestones?.map(String),
      },
    };
  }

  // Create the goal object with safe date parsing
  const goal: Goal = {
    id: crypto.randomUUID(),
    userId: 'default-user',
    title: result.data.title,
    description: result.data.description,
    category: result.data.category as GoalCategory,
    targetDate: safeParseDate(result.data.targetDate),
    priority: result.data.priority as GoalPriority,
    status: 'not_started' as GoalStatus,
    milestones: result.data.milestones.map((m) => ({
      ...m,
      targetDate: safeParseDate(m.targetDate),
      completedAt: safeParseDate(m.completedAt),
    })) as Milestone[],
    order: result.data.order ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    success: true,
    message: 'Goal created successfully',
    goal,
  };
}

/**
 * Update an existing goal
 */
export async function updateGoal(
  prevState: GoalFormState | null,
  formData: FormData
): Promise<GoalFormState> {
  const goalId = formData.get('goalId') as string;

  if (!goalId) {
    return {
      success: false,
      message: 'Goal ID is required',
    };
  }

  // Extract form data with safe parsing
  const milestonesRaw = safeJsonParse<unknown[]>(
    formData.get('milestones') as string,
    []
  );

  const rawData = {
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    category: formData.get('category'),
    targetDate: formData.get('targetDate') || undefined,
    priority: formData.get('priority'),
    milestones: milestonesRaw,
  };

  // Validate
  const result = GoalFormSchema.safeParse(rawData);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: {
        title: fieldErrors.title,
        description: fieldErrors.description,
        category: fieldErrors.category,
        targetDate: fieldErrors.targetDate,
        priority: fieldErrors.priority,
        milestones: fieldErrors.milestones?.map(String),
      },
    };
  }

  // Parse order from form data (preserving existing order during edit)
  const orderRaw = formData.get('order');
  const order = orderRaw ? parseInt(orderRaw as string, 10) : 0;

  // Create updated goal object with safe date parsing
  const goal: Goal = {
    id: goalId,
    userId: 'default-user',
    title: result.data.title,
    description: result.data.description,
    category: result.data.category as GoalCategory,
    targetDate: safeParseDate(result.data.targetDate),
    priority: result.data.priority as GoalPriority,
    status: (formData.get('status') as GoalStatus) || 'not_started',
    milestones: result.data.milestones.map((m) => ({
      ...m,
      targetDate: safeParseDate(m.targetDate),
      completedAt: safeParseDate(m.completedAt),
    })) as Milestone[],
    order: isNaN(order) ? 0 : order,
    createdAt: safeParseDate(formData.get('createdAt') as string) || new Date(),
    updatedAt: new Date(),
  };

  return {
    success: true,
    message: 'Goal updated successfully',
    goal,
  };
}
