import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  closeDatabase,
  deleteDatabase,
  timelineEvents,
  goals,
  userProfile,
  assessments,
  exportAllData,
  importData,
  clearAllData,
} from '@/lib/db';
import type { TimelineEvent, Goal, UserProfile, AssessmentResult } from '@/types';
import type { DatabaseExport } from '@/lib/db/types';

// Helper to generate unique IDs
const generateId = () => crypto.randomUUID();

// Test fixtures
const createTestEvent = (overrides?: Partial<TimelineEvent>): TimelineEvent => ({
  id: generateId(),
  userId: 'test-user',
  title: 'Test Event',
  description: 'A test event',
  startDate: new Date('2024-01-15'),
  layer: 'work',
  eventType: 'job',
  source: 'manual',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createTestGoal = (overrides?: Partial<Goal>): Goal => ({
  id: generateId(),
  userId: 'test-user',
  title: 'Test Goal',
  description: 'A test goal',
  category: 'career',
  priority: 'high',
  status: 'not_started',
  milestones: [],
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createTestProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
  id: 'default-user',
  name: 'Test User',
  birthDate: new Date('1992-05-15'),
  country: 'US',
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
  ...overrides,
});

const createTestAssessment = (overrides?: Partial<AssessmentResult>): AssessmentResult => ({
  id: generateId(),
  userId: 'test-user',
  assessmentType: 'personality_big5',
  completedAt: new Date(),
  scores: { openness: 75, conscientiousness: 80 },
  duration: 900,
  ...overrides,
});

const createDatabaseExport = (overrides?: Partial<DatabaseExport>): DatabaseExport => ({
  events: [],
  goals: [],
  profile: undefined,
  assessments: [],
  exportedAt: new Date(),
  version: '1.0',
  ...overrides,
});

describe('IndexedDB Storage Layer', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  describe('Database Operations', () => {
    it('should open and close database', async () => {
      // openDatabase now just ensures the adapter is initialized
      await openDatabase();
      // Verify database is operational by performing an operation
      const count = await timelineEvents.count();
      expect(count).toBeGreaterThanOrEqual(0);
      await closeDatabase();
    });

    it('should handle multiple initialize calls', async () => {
      // Multiple calls should be idempotent
      await openDatabase();
      await openDatabase();
      const count = await timelineEvents.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Timeline Events', () => {
    it('should add and retrieve an event', async () => {
      const event = createTestEvent();
      await timelineEvents.add(event);

      const retrieved = await timelineEvents.get(event.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe(event.title);
      expect(retrieved?.layer).toBe('work');
    });

    it('should update an event', async () => {
      const event = createTestEvent();
      await timelineEvents.add(event);

      const updatedEvent = { ...event, title: 'Updated Title' };
      await timelineEvents.update(updatedEvent);

      const retrieved = await timelineEvents.get(event.id);
      expect(retrieved?.title).toBe('Updated Title');
    });

    it('should delete an event', async () => {
      const event = createTestEvent();
      await timelineEvents.add(event);
      await timelineEvents.delete(event.id);

      const retrieved = await timelineEvents.get(event.id);
      expect(retrieved).toBeUndefined();
    });

    it('should get all events', async () => {
      const event1 = createTestEvent({ title: 'Event 1' });
      const event2 = createTestEvent({ title: 'Event 2' });
      await timelineEvents.add(event1);
      await timelineEvents.add(event2);

      const allEvents = await timelineEvents.getAll();
      expect(allEvents).toHaveLength(2);
    });

    it('should get events by layer', async () => {
      const workEvent = createTestEvent({ layer: 'work' });
      const healthEvent = createTestEvent({ layer: 'health' });
      await timelineEvents.add(workEvent);
      await timelineEvents.add(healthEvent);

      const workEvents = await timelineEvents.getByLayer('work');
      expect(workEvents).toHaveLength(1);
      expect(workEvents[0].layer).toBe('work');
    });

    it('should get events by source', async () => {
      const manualEvent = createTestEvent({ source: 'manual' });
      const facebookEvent = createTestEvent({ source: 'facebook' });
      await timelineEvents.add(manualEvent);
      await timelineEvents.add(facebookEvent);

      const manualEvents = await timelineEvents.getBySource('manual');
      expect(manualEvents).toHaveLength(1);
      expect(manualEvents[0].source).toBe('manual');
    });

    it('should get events by date range', async () => {
      const event1 = createTestEvent({ startDate: new Date('2024-01-15') });
      const event2 = createTestEvent({ startDate: new Date('2024-06-15') });
      const event3 = createTestEvent({ startDate: new Date('2024-12-15') });
      await timelineEvents.add(event1);
      await timelineEvents.add(event2);
      await timelineEvents.add(event3);

      const rangeEvents = await timelineEvents.getByDateRange(
        new Date('2024-01-01'),
        new Date('2024-07-01')
      );
      expect(rangeEvents).toHaveLength(2);
    });

    it('should count events', async () => {
      await timelineEvents.add(createTestEvent());
      await timelineEvents.add(createTestEvent());
      await timelineEvents.add(createTestEvent());

      const count = await timelineEvents.count();
      expect(count).toBe(3);
    });

    it('should clear all events', async () => {
      await timelineEvents.add(createTestEvent());
      await timelineEvents.add(createTestEvent());
      await timelineEvents.clear();

      const allEvents = await timelineEvents.getAll();
      expect(allEvents).toHaveLength(0);
    });
  });

  describe('Goals', () => {
    it('should add and retrieve a goal', async () => {
      const goal = createTestGoal();
      await goals.add(goal);

      const retrieved = await goals.get(goal.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe(goal.title);
    });

    it('should update a goal', async () => {
      const goal = createTestGoal();
      await goals.add(goal);

      const updatedGoal = { ...goal, status: 'in_progress' as const };
      await goals.update(updatedGoal);

      const retrieved = await goals.get(goal.id);
      expect(retrieved?.status).toBe('in_progress');
    });

    it('should delete a goal', async () => {
      const goal = createTestGoal();
      await goals.add(goal);
      await goals.delete(goal.id);

      const retrieved = await goals.get(goal.id);
      expect(retrieved).toBeUndefined();
    });

    it('should get goals by category', async () => {
      const careerGoal = createTestGoal({ category: 'career' });
      const healthGoal = createTestGoal({ category: 'health' });
      await goals.add(careerGoal);
      await goals.add(healthGoal);

      const careerGoals = await goals.getByCategory('career');
      expect(careerGoals).toHaveLength(1);
      expect(careerGoals[0].category).toBe('career');
    });

    it('should get goals by status', async () => {
      const notStarted = createTestGoal({ status: 'not_started' });
      const completed = createTestGoal({ status: 'completed' });
      await goals.add(notStarted);
      await goals.add(completed);

      const completedGoals = await goals.getByStatus('completed');
      expect(completedGoals).toHaveLength(1);
      expect(completedGoals[0].status).toBe('completed');
    });

    it('should get active goals', async () => {
      const notStarted = createTestGoal({ status: 'not_started' });
      const inProgress = createTestGoal({ status: 'in_progress' });
      const completed = createTestGoal({ status: 'completed' });
      await goals.add(notStarted);
      await goals.add(inProgress);
      await goals.add(completed);

      const activeGoals = await goals.getActive();
      expect(activeGoals).toHaveLength(2);
    });

    it('should count goals', async () => {
      await goals.add(createTestGoal());
      await goals.add(createTestGoal());

      const count = await goals.count();
      expect(count).toBe(2);
    });
  });

  describe('User Profile', () => {
    it('should save and retrieve profile', async () => {
      const profile = createTestProfile();
      await userProfile.save(profile);

      const retrieved = await userProfile.get();
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(profile.name);
    });

    it('should update profile', async () => {
      const profile = createTestProfile();
      await userProfile.save(profile);

      const updatedProfile = { ...profile, name: 'Updated Name' };
      await userProfile.save(updatedProfile);

      const retrieved = await userProfile.get();
      expect(retrieved?.name).toBe('Updated Name');
    });

    it('should check if profile exists', async () => {
      expect(await userProfile.exists()).toBe(false);

      await userProfile.save(createTestProfile());
      expect(await userProfile.exists()).toBe(true);
    });

    it('should delete profile', async () => {
      await userProfile.save(createTestProfile());
      await userProfile.delete();

      const retrieved = await userProfile.get();
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Assessments', () => {
    it('should add and retrieve an assessment', async () => {
      const assessment = createTestAssessment();
      await assessments.add(assessment);

      const retrieved = await assessments.get(assessment.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.assessmentType).toBe('personality_big5');
    });

    it('should get assessments by type', async () => {
      const personality = createTestAssessment({ assessmentType: 'personality_big5' });
      const iq = createTestAssessment({ assessmentType: 'iq' });
      await assessments.add(personality);
      await assessments.add(iq);

      const personalityAssessments = await assessments.getByType('personality_big5');
      expect(personalityAssessments).toHaveLength(1);
    });

    it('should get latest assessment by type', async () => {
      const older = createTestAssessment({
        assessmentType: 'iq',
        completedAt: new Date('2024-01-01'),
      });
      const newer = createTestAssessment({
        assessmentType: 'iq',
        completedAt: new Date('2024-06-01'),
      });
      await assessments.add(older);
      await assessments.add(newer);

      const latest = await assessments.getLatestByType('iq');
      expect(latest?.id).toBe(newer.id);
    });
  });

  describe('Data Export/Import', () => {
    it('should export all data', async () => {
      await timelineEvents.add(createTestEvent());
      await goals.add(createTestGoal());
      await userProfile.save(createTestProfile());
      await assessments.add(createTestAssessment());

      const exported = await exportAllData();
      expect(exported.events).toHaveLength(1);
      expect(exported.goals).toHaveLength(1);
      expect(exported.profile).toBeDefined();
      expect(exported.assessments).toHaveLength(1);
    });

    it('should import data', async () => {
      const data = createDatabaseExport({
        events: [createTestEvent()],
        goals: [createTestGoal()],
        profile: createTestProfile(),
        assessments: [createTestAssessment()],
      });

      await importData(data);

      expect(await timelineEvents.count()).toBe(1);
      expect(await goals.count()).toBe(1);
      expect(await userProfile.exists()).toBe(true);
      expect((await assessments.getAll()).length).toBe(1);
    });

    it('should clear all data', async () => {
      await timelineEvents.add(createTestEvent());
      await goals.add(createTestGoal());
      await userProfile.save(createTestProfile());
      await assessments.add(createTestAssessment());

      await clearAllData();

      expect(await timelineEvents.count()).toBe(0);
      expect(await goals.count()).toBe(0);
      expect(await userProfile.exists()).toBe(false);
      expect((await assessments.getAll()).length).toBe(0);
    });

    it('should export empty data when no records exist', async () => {
      const exported = await exportAllData();
      expect(exported.events).toHaveLength(0);
      expect(exported.goals).toHaveLength(0);
      expect(exported.profile).toBeUndefined();
      expect(exported.assessments).toHaveLength(0);
    });

    it('should handle partial import data', async () => {
      // Import only events
      await importData(createDatabaseExport({ events: [createTestEvent()] }));
      expect(await timelineEvents.count()).toBe(1);
      expect(await goals.count()).toBe(0);

      // Import only goals
      await clearAllData();
      await importData(createDatabaseExport({ goals: [createTestGoal()] }));
      expect(await timelineEvents.count()).toBe(0);
      expect(await goals.count()).toBe(1);
    });

    it('should import multiple events', async () => {
      const data = createDatabaseExport({
        events: [
          createTestEvent({ title: 'Event 1' }),
          createTestEvent({ title: 'Event 2' }),
          createTestEvent({ title: 'Event 3' }),
        ],
      });

      await importData(data);
      expect(await timelineEvents.count()).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    describe('Timeline Events Edge Cases', () => {
      it('should handle events with all optional fields', async () => {
        const event = createTestEvent({
          description: 'Full description',
          endDate: new Date('2024-02-15'),
          sourceId: 'external-123',
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            name: 'New York',
            country: 'US',
          },
          media: [
            {
              id: 'media-1',
              type: 'image',
              url: 'https://example.com/photo.jpg',
              thumbnail: 'https://example.com/thumb.jpg',
              caption: 'Event photo',
            },
          ],
          metadata: { custom: 'data', nested: { value: 123 } },
        });

        await timelineEvents.add(event);
        const retrieved = await timelineEvents.get(event.id);

        expect(retrieved?.endDate).toBeDefined();
        expect(retrieved?.location?.name).toBe('New York');
        expect(retrieved?.media).toHaveLength(1);
        expect(retrieved?.metadata?.custom).toBe('data');
      });

      it('should handle empty date range query', async () => {
        await timelineEvents.add(createTestEvent({ startDate: new Date('2024-06-15') }));

        const results = await timelineEvents.getByDateRange(
          new Date('2020-01-01'),
          new Date('2020-12-31')
        );

        expect(results).toHaveLength(0);
      });

      it('should handle getting non-existent event', async () => {
        const result = await timelineEvents.get('non-existent-id');
        expect(result).toBeUndefined();
      });

      it('should handle deleting non-existent event without error', async () => {
        // Should not throw
        await timelineEvents.delete('non-existent-id');
      });

      it('should count zero when empty', async () => {
        const count = await timelineEvents.count();
        expect(count).toBe(0);
      });

      it('should return empty array for non-existent layer', async () => {
        await timelineEvents.add(createTestEvent({ layer: 'work' }));
        const results = await timelineEvents.getByLayer('travel');
        expect(results).toHaveLength(0);
      });
    });

    describe('Goals Edge Cases', () => {
      it('should handle goals with milestones', async () => {
        const goal = createTestGoal({
          milestones: [
            { id: 'ms-1', title: 'Milestone 1', completed: false },
            { id: 'ms-2', title: 'Milestone 2', completed: true, completedAt: new Date() },
            { id: 'ms-3', title: 'Milestone 3', completed: false },
          ],
        });

        await goals.add(goal);
        const retrieved = await goals.get(goal.id);

        expect(retrieved?.milestones).toHaveLength(3);
        expect(retrieved?.milestones[1].completed).toBe(true);
        expect(retrieved?.milestones[1].completedAt).toBeDefined();
      });

      it('should handle goal with target date', async () => {
        const goal = createTestGoal({
          targetDate: new Date('2025-12-31'),
        });

        await goals.add(goal);
        const retrieved = await goals.get(goal.id);

        expect(retrieved?.targetDate).toBeDefined();
      });

      it('should return empty array when no active goals', async () => {
        await goals.add(createTestGoal({ status: 'completed' }));
        await goals.add(createTestGoal({ status: 'abandoned' }));

        const active = await goals.getActive();
        expect(active).toHaveLength(0);
      });

      it('should count zero when no goals', async () => {
        const count = await goals.count();
        expect(count).toBe(0);
      });
    });

    describe('User Profile Edge Cases', () => {
      it('should handle profile with optional fields', async () => {
        const profile = createTestProfile({
          gender: 'male',
          lifeExpectancy: 85,
        });

        await userProfile.save(profile);
        const retrieved = await userProfile.get();

        expect(retrieved?.gender).toBe('male');
        expect(retrieved?.lifeExpectancy).toBe(85);
      });

      it('should handle profile without optional fields', async () => {
        const profile: UserProfile = {
          id: 'default-user',
          name: 'Minimal User',
          birthDate: new Date('1990-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
          settings: {
            theme: 'dark',
            defaultView: 'timeline',
            sidebarCollapsed: false,
            notifications: {
              goalReminders: false,
              milestoneAlerts: false,
              coachingPrompts: false,
            },
          },
        };

        await userProfile.save(profile);
        const retrieved = await userProfile.get();

        expect(retrieved?.name).toBe('Minimal User');
        expect(retrieved?.country).toBeUndefined();
        expect(retrieved?.gender).toBeUndefined();
        expect(retrieved?.lifeExpectancy).toBeUndefined();
      });

      it('should not exist after delete', async () => {
        await userProfile.save(createTestProfile());
        expect(await userProfile.exists()).toBe(true);

        await userProfile.delete();
        expect(await userProfile.exists()).toBe(false);
      });
    });

    describe('Assessments Edge Cases', () => {
      it('should return undefined for latest when no assessments of type', async () => {
        await assessments.add(createTestAssessment({ assessmentType: 'personality_big5' }));

        const latest = await assessments.getLatestByType('iq');
        expect(latest).toBeUndefined();
      });

      it('should handle assessment with various score types', async () => {
        const assessment = createTestAssessment({
          scores: {
            numeric: 95,
            personality_type: 'INTJ',
            percentile: 85,
          },
        });

        await assessments.add(assessment);
        const retrieved = await assessments.get(assessment.id);

        expect(retrieved?.scores.numeric).toBe(95);
        expect(retrieved?.scores.personality_type).toBe('INTJ');
        expect(retrieved?.scores.percentile).toBe(85);
      });

      it('should update assessment', async () => {
        const assessment = createTestAssessment();
        await assessments.add(assessment);

        const updated = { ...assessment, scores: { openness: 90 } };
        await assessments.update(updated);

        const retrieved = await assessments.get(assessment.id);
        expect(retrieved?.scores.openness).toBe(90);
      });

      it('should delete assessment', async () => {
        const assessment = createTestAssessment();
        await assessments.add(assessment);
        await assessments.delete(assessment.id);

        const retrieved = await assessments.get(assessment.id);
        expect(retrieved).toBeUndefined();
      });

      it('should clear all assessments', async () => {
        await assessments.add(createTestAssessment());
        await assessments.add(createTestAssessment());
        await assessments.clear();

        const all = await assessments.getAll();
        expect(all).toHaveLength(0);
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle multiple concurrent adds', async () => {
        const events = Array.from({ length: 10 }, (_, i) =>
          createTestEvent({ title: `Event ${i}` })
        );

        await Promise.all(events.map((e) => timelineEvents.add(e)));

        const count = await timelineEvents.count();
        expect(count).toBe(10);
      });

      it('should handle concurrent reads and writes', async () => {
        const event = createTestEvent();
        await timelineEvents.add(event);

        // Concurrent operations
        const operations = [
          timelineEvents.getAll(),
          timelineEvents.count(),
          timelineEvents.getByLayer('work'),
          timelineEvents.get(event.id),
        ];

        const results = await Promise.all(operations);
        expect(results[0]).toHaveLength(1);
        expect(results[1]).toBe(1);
        expect(results[3]).toBeDefined();
      });
    });
  });
});
