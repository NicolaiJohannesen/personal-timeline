import { describe, it, expect } from 'vitest';
import {
  buildContextSummary,
  buildSystemPrompt,
  formatConversationHistory,
  type CoachingContext,
  type CoachingFocus,
} from '@/lib/coach/contextBuilder';
import type { TimelineEvent, Goal, UserProfile, AssessmentResult } from '@/types';

describe('contextBuilder', () => {
  // Sample test data
  const mockEvents: TimelineEvent[] = [
    {
      id: 'event-1',
      title: 'Started new job',
      description: 'Joined as Software Engineer',
      startDate: '2024-01-15',
      layer: 'work',
      source: 'manual',
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 'event-2',
      title: 'Trip to Japan',
      description: 'Two week vacation',
      startDate: '2024-03-01',
      endDate: '2024-03-14',
      layer: 'travel',
      source: 'manual',
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    },
    {
      id: 'event-3',
      title: 'Promotion',
      description: 'Promoted to Senior Engineer',
      startDate: '2024-06-01',
      layer: 'work',
      source: 'manual',
      createdAt: '2024-06-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    },
  ];

  const mockGoals: Goal[] = [
    {
      id: 'goal-1',
      title: 'Learn Spanish',
      description: 'Become conversational in Spanish',
      category: 'education',
      status: 'in_progress',
      milestones: [
        { id: 'm1', title: 'Complete beginner course', completed: true, completedAt: '2024-01-01' },
        { id: 'm2', title: 'Complete intermediate course', completed: false },
        { id: 'm3', title: 'Have 10 conversations', completed: false },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      order: 0,
    },
    {
      id: 'goal-2',
      title: 'Run a marathon',
      description: 'Complete a full marathon',
      category: 'health',
      status: 'not_started',
      milestones: [],
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-01T00:00:00Z',
      order: 1,
    },
    {
      id: 'goal-3',
      title: 'Previous goal',
      description: 'Already completed',
      category: 'personal',
      status: 'completed',
      milestones: [
        { id: 'm4', title: 'Done', completed: true, completedAt: '2023-12-01' },
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-12-01T00:00:00Z',
      order: 2,
    },
  ];

  const mockProfile: UserProfile = {
    id: 'profile-1',
    name: 'John Doe',
    birthDate: '1990-05-15',
    country: 'USA',
    lifeExpectancy: 80,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockAssessments: AssessmentResult[] = [
    {
      id: 'assessment-1',
      assessmentType: 'big_five',
      completedAt: '2024-02-15T00:00:00Z',
      scores: {
        openness: 75,
        conscientiousness: 80,
        extraversion: 60,
        agreeableness: 70,
        neuroticism: 40,
      },
      createdAt: '2024-02-15T00:00:00Z',
      updatedAt: '2024-02-15T00:00:00Z',
    },
  ];

  const defaultFocus: CoachingFocus = {
    goalProgress: true,
    lifePatterns: true,
    mentalWellness: false,
    careerGuidance: false,
  };

  describe('buildContextSummary', () => {
    it('should build context summary with all data', () => {
      const context: CoachingContext = {
        events: mockEvents,
        goals: mockGoals,
        profile: mockProfile,
        assessments: mockAssessments,
      };

      const summary = buildContextSummary(context, defaultFocus);

      expect(summary.profileName).toBe('John Doe');
      expect(summary.eventsCount).toBe(3);
      expect(summary.coachingFocus).toEqual(defaultFocus);
    });

    it('should count events by layer', () => {
      const context: CoachingContext = {
        events: mockEvents,
        goals: [],
        profile: null,
        assessments: [],
      };

      const summary = buildContextSummary(context, defaultFocus);

      expect(summary.eventsByLayer).toEqual({
        work: 2,
        travel: 1,
      });
    });

    it('should include recent events sorted by date (newest first)', () => {
      const context: CoachingContext = {
        events: mockEvents,
        goals: [],
        profile: null,
        assessments: [],
      };

      const summary = buildContextSummary(context, defaultFocus);

      expect(summary.recentEvents).toHaveLength(3);
      expect(summary.recentEvents[0].title).toBe('Promotion');
      expect(summary.recentEvents[0].layer).toBe('work');
      expect(summary.recentEvents[0].date).toBe('2024-06-01');
    });

    it('should limit recent events to 20', () => {
      const manyEvents: TimelineEvent[] = Array.from({ length: 30 }, (_, i) => ({
        id: `event-${i}`,
        title: `Event ${i}`,
        description: '',
        startDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
        layer: 'work' as const,
        source: 'manual' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }));

      const context: CoachingContext = {
        events: manyEvents,
        goals: [],
        profile: null,
        assessments: [],
      };

      const summary = buildContextSummary(context, defaultFocus);

      expect(summary.recentEvents).toHaveLength(20);
    });

    it('should include only active goals', () => {
      const context: CoachingContext = {
        events: [],
        goals: mockGoals,
        profile: null,
        assessments: [],
      };

      const summary = buildContextSummary(context, defaultFocus);

      expect(summary.activeGoals).toHaveLength(2);
      expect(summary.activeGoals.map(g => g.title)).toEqual(['Learn Spanish', 'Run a marathon']);
    });

    it('should format milestone progress correctly', () => {
      const context: CoachingContext = {
        events: [],
        goals: mockGoals,
        profile: null,
        assessments: [],
      };

      const summary = buildContextSummary(context, defaultFocus);

      const spanishGoal = summary.activeGoals.find(g => g.title === 'Learn Spanish');
      expect(spanishGoal?.milestoneProgress).toBe('1/3 milestones');

      const marathonGoal = summary.activeGoals.find(g => g.title === 'Run a marathon');
      expect(marathonGoal?.milestoneProgress).toBe('No milestones set');
    });

    it('should include assessment summary', () => {
      const context: CoachingContext = {
        events: [],
        goals: [],
        profile: null,
        assessments: mockAssessments,
      };

      const summary = buildContextSummary(context, defaultFocus);

      expect(summary.assessmentSummary).toBeDefined();
      expect(summary.assessmentSummary?.big_five).toBeDefined();
      const bigFive = summary.assessmentSummary?.big_five as { completedAt: string; scores: Record<string, unknown> };
      expect(bigFive.completedAt).toBe('2024-02-15');
    });

    it('should handle empty context', () => {
      const context: CoachingContext = {
        events: [],
        goals: [],
        profile: null,
        assessments: [],
      };

      const summary = buildContextSummary(context, defaultFocus);

      expect(summary.profileName).toBeUndefined();
      expect(summary.eventsCount).toBe(0);
      expect(summary.eventsByLayer).toEqual({});
      expect(summary.recentEvents).toEqual([]);
      expect(summary.activeGoals).toEqual([]);
      expect(summary.assessmentSummary).toBeUndefined();
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build a system prompt with focus areas', () => {
      const summary = buildContextSummary(
        { events: mockEvents, goals: mockGoals, profile: mockProfile, assessments: [] },
        { goalProgress: true, lifePatterns: false, mentalWellness: true, careerGuidance: false }
      );

      const prompt = buildSystemPrompt(summary);

      expect(prompt).toContain('AI Life Coach');
      expect(prompt).toContain('goal progress and achievement');
      expect(prompt).toContain('mental wellness and emotional support');
      expect(prompt).not.toContain('life patterns and trends');
      expect(prompt).not.toContain('career guidance');
    });

    it('should include user name when available', () => {
      const summary = buildContextSummary(
        { events: [], goals: [], profile: mockProfile, assessments: [] },
        defaultFocus
      );

      const prompt = buildSystemPrompt(summary);

      expect(prompt).toContain('Name: John Doe');
    });

    it('should include event counts by layer', () => {
      const summary = buildContextSummary(
        { events: mockEvents, goals: [], profile: null, assessments: [] },
        defaultFocus
      );

      const prompt = buildSystemPrompt(summary);

      expect(prompt).toContain('Total Timeline Events: 3');
      expect(prompt).toContain('work: 2 events');
      expect(prompt).toContain('travel: 1 events');
    });

    it('should include active goals', () => {
      const summary = buildContextSummary(
        { events: [], goals: mockGoals, profile: null, assessments: [] },
        defaultFocus
      );

      const prompt = buildSystemPrompt(summary);

      expect(prompt).toContain('Active Goals');
      expect(prompt).toContain('Learn Spanish');
      expect(prompt).toContain('education');
      expect(prompt).toContain('1/3 milestones');
    });

    it('should include recent events', () => {
      const summary = buildContextSummary(
        { events: mockEvents, goals: [], profile: null, assessments: [] },
        defaultFocus
      );

      const prompt = buildSystemPrompt(summary);

      expect(prompt).toContain('Recent Events');
      expect(prompt).toContain('Promotion');
      expect(prompt).toContain('[work]');
    });

    it('should use default focus when none selected', () => {
      const summary = buildContextSummary(
        { events: [], goals: [], profile: null, assessments: [] },
        { goalProgress: false, lifePatterns: false, mentalWellness: false, careerGuidance: false }
      );

      const prompt = buildSystemPrompt(summary);

      expect(prompt).toContain('general life guidance');
    });
  });

  describe('formatConversationHistory', () => {
    it('should format messages correctly', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      const formatted = formatConversationHistory(messages);

      expect(formatted).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);
    });

    it('should limit to last 10 messages', () => {
      const messages = Array.from({ length: 15 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
      }));

      const formatted = formatConversationHistory(messages);

      expect(formatted).toHaveLength(10);
      expect(formatted[0].content).toBe('Message 5');
      expect(formatted[9].content).toBe('Message 14');
    });

    it('should handle empty history', () => {
      const formatted = formatConversationHistory([]);

      expect(formatted).toEqual([]);
    });
  });
});
