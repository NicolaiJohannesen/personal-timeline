import { describe, it, expect } from 'vitest';
import { validateDatabaseExport, parseAndValidateDatabaseExport } from '@/lib/db/validation';

describe('Database Validation', () => {
  describe('validateDatabaseExport', () => {
    it('validates valid export data', () => {
      const validData = {
        events: [
          {
            id: 'test-id',
            userId: 'user-1',
            title: 'Test Event',
            startDate: new Date(),
            layer: 'media',
            eventType: 'photo',
            source: 'manual',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        goals: [],
        profile: undefined,
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(validData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.eventsCount).toBe(1);
    });

    it('rejects non-object data', () => {
      const result = validateDatabaseExport(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid data structure');
    });

    it('rejects missing version', () => {
      const data = {
        events: [],
        goals: [],
        assessments: [],
        exportedAt: new Date(),
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'version')).toBe(true);
    });

    it('rejects invalid event structure', () => {
      const data = {
        events: [
          {
            // Missing required fields
            title: 'Test',
          },
        ],
        goals: [],
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'events')).toBe(true);
    });

    it('rejects invalid goal structure', () => {
      const data = {
        events: [],
        goals: [
          {
            // Missing required fields
            title: 'Test Goal',
          },
        ],
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'goals')).toBe(true);
    });

    it('reports correct stats', () => {
      const data = {
        events: [
          {
            id: '1',
            userId: 'user',
            title: 'Event 1',
            startDate: new Date(),
            layer: 'media',
            eventType: 'photo',
            source: 'manual',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            userId: 'user',
            title: 'Event 2',
            startDate: new Date(),
            layer: 'travel',
            eventType: 'trip',
            source: 'google',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        goals: [
          {
            id: '1',
            userId: 'user',
            title: 'Goal 1',
            category: 'career',
            priority: 'high',
            status: 'in_progress',
            milestones: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        profile: {
          id: 'profile-1',
          name: 'Test User',
          birthDate: new Date('1990-01-01'),
        },
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.stats.eventsCount).toBe(2);
      expect(result.stats.goalsCount).toBe(1);
      expect(result.stats.hasProfile).toBe(true);
      expect(result.stats.assessmentsCount).toBe(0);
    });

    it('warns about empty data', () => {
      const data = {
        events: [],
        goals: [],
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.message.includes('empty'))).toBe(true);
    });

    it('rejects events array that is not an array', () => {
      const data = {
        events: 'not an array',
        goals: [],
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Events must be an array'))).toBe(true);
    });

    it('validates event layer enum', () => {
      const data = {
        events: [
          {
            id: '1',
            userId: 'user',
            title: 'Test',
            startDate: new Date(),
            layer: 'invalid_layer', // Invalid layer
            eventType: 'photo',
            source: 'manual',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        goals: [],
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(false);
    });

    it('validates goal category enum', () => {
      const data = {
        events: [],
        goals: [
          {
            id: '1',
            userId: 'user',
            title: 'Test',
            category: 'invalid_category', // Invalid category
            priority: 'high',
            status: 'in_progress',
            milestones: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(false);
    });

    it('validates assessment structure', () => {
      const data = {
        events: [],
        goals: [],
        assessments: [
          {
            id: '1',
            userId: 'user',
            assessmentType: 'big_five',
            scores: { openness: 75 },
            completedAt: new Date(),
          },
        ],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(true);
    });

    it('validates string dates', () => {
      const data = {
        events: [
          {
            id: '1',
            userId: 'user',
            title: 'Test',
            startDate: '2024-01-15T10:00:00Z', // ISO string
            layer: 'media',
            eventType: 'photo',
            source: 'manual',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
        goals: [],
        assessments: [],
        exportedAt: '2024-01-15T10:00:00Z',
        version: '1.0',
      };

      const result = validateDatabaseExport(data);

      expect(result.valid).toBe(true);
    });
  });

  describe('parseAndValidateDatabaseExport', () => {
    it('returns parsed data for valid input', () => {
      const data = {
        events: [],
        goals: [],
        assessments: [],
        exportedAt: new Date(),
        version: '1.0',
      };

      const result = parseAndValidateDatabaseExport(data);

      expect(result.version).toBe('1.0');
      expect(result.events).toEqual([]);
    });

    it('throws error for invalid input', () => {
      const data = {
        events: 'not an array',
      };

      expect(() => parseAndValidateDatabaseExport(data)).toThrow();
    });

    it('throws descriptive error message', () => {
      const data = null;

      expect(() => parseAndValidateDatabaseExport(data)).toThrow(/Invalid/);
    });
  });
});
