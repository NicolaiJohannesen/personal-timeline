/**
 * Database import validation utilities
 * Ensures data integrity before importing into the database
 */

import { z } from 'zod';
import type { DatabaseExport } from './types';

// Validation schemas for database records

const LocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().optional(),
  country: z.string().optional(),
}).optional();

const TimelineEventSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  startDate: z.union([z.date(), z.string().datetime()]),
  endDate: z.union([z.date(), z.string().datetime()]).optional(),
  layer: z.enum(['economics', 'education', 'work', 'health', 'relationships', 'travel', 'media']),
  eventType: z.string().max(100),
  source: z.string().max(100),
  sourceId: z.string().max(500).optional(),
  location: LocationSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.union([z.date(), z.string().datetime()]),
  updatedAt: z.union([z.date(), z.string().datetime()]),
});

const MilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  targetDate: z.union([z.date(), z.string().datetime()]).optional(),
  completed: z.boolean(),
  completedAt: z.union([z.date(), z.string().datetime()]).optional(),
});

const GoalSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(['career', 'health', 'finance', 'personal', 'relationship', 'travel']),
  targetDate: z.union([z.date(), z.string().datetime()]).optional(),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['not_started', 'in_progress', 'completed', 'abandoned']),
  milestones: z.array(MilestoneSchema).default([]),
  createdAt: z.union([z.date(), z.string().datetime()]),
  updatedAt: z.union([z.date(), z.string().datetime()]),
});

const UserProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  birthDate: z.union([z.date(), z.string()]),
  expectedLifespan: z.number().min(1).max(150).optional(),
  location: z.string().max(200).optional(),
  occupation: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  createdAt: z.union([z.date(), z.string().datetime()]).optional(),
  updatedAt: z.union([z.date(), z.string().datetime()]).optional(),
}).optional();

const AssessmentResultSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  assessmentType: z.string().min(1).max(100),
  scores: z.record(z.string(), z.union([z.number(), z.string()])),
  responses: z.record(z.string(), z.unknown()).optional(),
  completedAt: z.union([z.date(), z.string().datetime()]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const DatabaseExportSchema = z.object({
  events: z.array(TimelineEventSchema).default([]),
  goals: z.array(GoalSchema).default([]),
  profile: UserProfileSchema,
  assessments: z.array(AssessmentResultSchema).default([]),
  exportedAt: z.union([z.date(), z.string().datetime()]),
  version: z.string().min(1),
});

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    eventsCount: number;
    goalsCount: number;
    assessmentsCount: number;
    hasProfile: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  index?: number;
}

export interface ValidationWarning {
  field: string;
  message: string;
  index?: number;
}

/**
 * Validate database export data before importing
 */
export function validateDatabaseExport(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic structure check
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'root', message: 'Invalid data structure: expected an object' }],
      warnings: [],
      stats: { eventsCount: 0, goalsCount: 0, assessmentsCount: 0, hasProfile: false },
    };
  }

  const dataObj = data as Record<string, unknown>;

  // Check version
  if (!dataObj.version || typeof dataObj.version !== 'string') {
    errors.push({ field: 'version', message: 'Missing or invalid version field' });
  }

  // Check exportedAt
  if (!dataObj.exportedAt) {
    errors.push({ field: 'exportedAt', message: 'Missing exportedAt field' });
  }

  // Validate events array
  let eventsCount = 0;
  if (dataObj.events !== undefined) {
    if (!Array.isArray(dataObj.events)) {
      errors.push({ field: 'events', message: 'Events must be an array' });
    } else {
      eventsCount = dataObj.events.length;
      for (let i = 0; i < dataObj.events.length; i++) {
        const eventResult = TimelineEventSchema.safeParse(dataObj.events[i]);
        if (!eventResult.success) {
          const errorMessages = eventResult.error.issues.map((e: z.ZodIssue) => e.message).join(', ');
          errors.push({
            field: 'events',
            message: `Invalid event at index ${i}: ${errorMessages}`,
            index: i,
          });
        }
      }
    }
  }

  // Validate goals array
  let goalsCount = 0;
  if (dataObj.goals !== undefined) {
    if (!Array.isArray(dataObj.goals)) {
      errors.push({ field: 'goals', message: 'Goals must be an array' });
    } else {
      goalsCount = dataObj.goals.length;
      for (let i = 0; i < dataObj.goals.length; i++) {
        const goalResult = GoalSchema.safeParse(dataObj.goals[i]);
        if (!goalResult.success) {
          const errorMessages = goalResult.error.issues.map((e: z.ZodIssue) => e.message).join(', ');
          errors.push({
            field: 'goals',
            message: `Invalid goal at index ${i}: ${errorMessages}`,
            index: i,
          });
        }
      }
    }
  }

  // Validate assessments array
  let assessmentsCount = 0;
  if (dataObj.assessments !== undefined) {
    if (!Array.isArray(dataObj.assessments)) {
      errors.push({ field: 'assessments', message: 'Assessments must be an array' });
    } else {
      assessmentsCount = dataObj.assessments.length;
      for (let i = 0; i < dataObj.assessments.length; i++) {
        const assessmentResult = AssessmentResultSchema.safeParse(dataObj.assessments[i]);
        if (!assessmentResult.success) {
          const errorMessages = assessmentResult.error.issues.map((e: z.ZodIssue) => e.message).join(', ');
          errors.push({
            field: 'assessments',
            message: `Invalid assessment at index ${i}: ${errorMessages}`,
            index: i,
          });
        }
      }
    }
  }

  // Validate profile
  let hasProfile = false;
  if (dataObj.profile !== undefined && dataObj.profile !== null) {
    hasProfile = true;
    const profileResult = UserProfileSchema.safeParse(dataObj.profile);
    if (!profileResult.success) {
      const errorMessages = profileResult.error.issues.map((e: z.ZodIssue) => e.message).join(', ');
      errors.push({
        field: 'profile',
        message: `Invalid profile: ${errorMessages}`,
      });
    }
  }

  // Add warnings for empty data
  if (eventsCount === 0 && goalsCount === 0 && assessmentsCount === 0 && !hasProfile) {
    warnings.push({ field: 'root', message: 'Import data appears to be empty' });
  }

  // Add warnings for large imports
  if (eventsCount > 10000) {
    warnings.push({ field: 'events', message: `Large import: ${eventsCount} events may take time to process` });
  }
  if (goalsCount > 1000) {
    warnings.push({ field: 'goals', message: `Large import: ${goalsCount} goals` });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      eventsCount,
      goalsCount,
      assessmentsCount,
      hasProfile,
    },
  };
}

/**
 * Validate and return parsed DatabaseExport or throw error
 */
export function parseAndValidateDatabaseExport(data: unknown): DatabaseExport {
  const validation = validateDatabaseExport(data);

  if (!validation.valid) {
    const errorMessages = validation.errors.map(e => e.message).join('; ');
    throw new Error(`Invalid import data: ${errorMessages}`);
  }

  // Parse with schema to ensure correct types
  return DatabaseExportSchema.parse(data) as unknown as DatabaseExport;
}
