/**
 * In-Memory Database Adapter
 * Useful for testing and SSR scenarios
 */

import type {
  TimelineEvent,
  Goal,
  UserProfile,
  AssessmentResult,
  DataLayer,
} from '@/types';
import type {
  DatabaseAdapter,
  DatabaseExport,
  TimelineEventsRepository,
  GoalsRepository,
  UserProfileRepository,
  AssessmentsRepository,
} from '../types';
import { validateDatabaseExport } from '../validation';

/**
 * In-Memory Adapter Implementation
 * All data is stored in memory and lost on page refresh
 */
export class MemoryAdapter implements DatabaseAdapter {
  readonly name = 'memory';

  private eventsStore: Map<string, TimelineEvent> = new Map();
  private goalsStore: Map<string, Goal> = new Map();
  private profileStore: UserProfile | undefined = undefined;
  private assessmentsStore: Map<string, AssessmentResult> = new Map();

  timelineEvents: TimelineEventsRepository;
  goals: GoalsRepository;
  userProfile: UserProfileRepository;
  assessments: AssessmentsRepository;

  constructor() {
    this.timelineEvents = new MemoryTimelineEvents(this.eventsStore);
    this.goals = new MemoryGoals(this.goalsStore);
    this.userProfile = new MemoryUserProfile(() => this.profileStore, (p) => { this.profileStore = p; });
    this.assessments = new MemoryAssessments(this.assessmentsStore);
  }

  async initialize(): Promise<void> {
    // No initialization needed for memory adapter
  }

  async close(): Promise<void> {
    // No cleanup needed
  }

  async exportAllData(): Promise<DatabaseExport> {
    return {
      events: await this.timelineEvents.getAll(),
      goals: await this.goals.getAll(),
      profile: await this.userProfile.get(),
      assessments: await this.assessments.getAll(),
      exportedAt: new Date(),
      version: '1.0',
    };
  }

  async importData(data: DatabaseExport): Promise<void> {
    // Validate data before importing (matches IndexedDB adapter behavior)
    const validation = validateDatabaseExport(data);
    if (!validation.valid) {
      throw new Error(`Import validation failed: ${validation.errors.map(e => e.message).join('; ')}`);
    }

    if (data.events) {
      await this.timelineEvents.addBatch(data.events);
    }
    if (data.goals) {
      for (const goal of data.goals) {
        await this.goals.add(goal);
      }
    }
    if (data.profile) {
      await this.userProfile.save(data.profile);
    }
    if (data.assessments) {
      for (const assessment of data.assessments) {
        await this.assessments.add(assessment);
      }
    }
  }

  async clearAllData(): Promise<void> {
    this.eventsStore.clear();
    this.goalsStore.clear();
    this.profileStore = undefined;
    this.assessmentsStore.clear();
  }
}

/**
 * Memory Timeline Events Repository
 */
class MemoryTimelineEvents implements TimelineEventsRepository {
  constructor(private store: Map<string, TimelineEvent>) {}

  async add(event: TimelineEvent): Promise<TimelineEvent> {
    this.store.set(event.id, event);
    return event;
  }

  async update(event: TimelineEvent): Promise<TimelineEvent> {
    this.store.set(event.id, event);
    return event;
  }

  async get(id: string): Promise<TimelineEvent | undefined> {
    return this.store.get(id);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async getAll(): Promise<TimelineEvent[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async getByLayer(layer: DataLayer): Promise<TimelineEvent[]> {
    return Array.from(this.store.values()).filter((e) => e.layer === layer);
  }

  async getBySource(source: string): Promise<TimelineEvent[]> {
    return Array.from(this.store.values()).filter((e) => e.source === source);
  }

  async getBySourceId(sourceId: string): Promise<TimelineEvent | undefined> {
    return Array.from(this.store.values()).find((e) => e.sourceId === sourceId);
  }

  async getByDateRange(startDate: Date, endDate: Date): Promise<TimelineEvent[]> {
    return Array.from(this.store.values()).filter((event) => {
      const eventDate = new Date(event.startDate);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }

  async addBatch(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    for (const event of events) {
      this.store.set(event.id, event);
    }
    return events;
  }
}

/**
 * Memory Goals Repository
 */
class MemoryGoals implements GoalsRepository {
  constructor(private store: Map<string, Goal>) {}

  async add(goal: Goal): Promise<Goal> {
    this.store.set(goal.id, goal);
    return goal;
  }

  async update(goal: Goal): Promise<Goal> {
    this.store.set(goal.id, goal);
    return goal;
  }

  async get(id: string): Promise<Goal | undefined> {
    return this.store.get(id);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async getAll(): Promise<Goal[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async getByCategory(category: string): Promise<Goal[]> {
    return Array.from(this.store.values()).filter((g) => g.category === category);
  }

  async getByStatus(status: string): Promise<Goal[]> {
    return Array.from(this.store.values()).filter((g) => g.status === status);
  }

  async getActive(): Promise<Goal[]> {
    return Array.from(this.store.values()).filter(
      (g) => g.status === 'not_started' || g.status === 'in_progress'
    );
  }

  async updateOrder(goals: Array<{ id: string; order: number }>): Promise<void> {
    for (const { id, order } of goals) {
      const goal = this.store.get(id);
      if (goal) {
        goal.order = order;
        goal.updatedAt = new Date();
        this.store.set(id, goal);
      }
    }
  }
}

/**
 * Memory User Profile Repository
 */
class MemoryUserProfile implements UserProfileRepository {
  constructor(
    private getProfile: () => UserProfile | undefined,
    private setProfile: (p: UserProfile | undefined) => void
  ) {}

  async get(): Promise<UserProfile | undefined> {
    return this.getProfile();
  }

  async save(profile: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const fullProfile: UserProfile = { ...profile, id: 'default-user' };
    this.setProfile(fullProfile);
    return fullProfile;
  }

  async exists(): Promise<boolean> {
    return this.getProfile() !== undefined;
  }

  async delete(): Promise<void> {
    this.setProfile(undefined);
  }
}

/**
 * Memory Assessments Repository
 */
class MemoryAssessments implements AssessmentsRepository {
  constructor(private store: Map<string, AssessmentResult>) {}

  async add(assessment: AssessmentResult): Promise<AssessmentResult> {
    this.store.set(assessment.id, assessment);
    return assessment;
  }

  async update(assessment: AssessmentResult): Promise<AssessmentResult> {
    this.store.set(assessment.id, assessment);
    return assessment;
  }

  async get(id: string): Promise<AssessmentResult | undefined> {
    return this.store.get(id);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async getAll(): Promise<AssessmentResult[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async getByType(type: string): Promise<AssessmentResult[]> {
    return Array.from(this.store.values()).filter((a) => a.assessmentType === type);
  }

  async getLatestByType(type: string): Promise<AssessmentResult | undefined> {
    const results = await this.getByType(type);
    if (results.length === 0) return undefined;
    return results.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )[0];
  }
}
