/**
 * Database Repository Interfaces
 * These interfaces define the contract for data storage.
 * Any database adapter must implement these interfaces.
 */

import type {
  TimelineEvent,
  Goal,
  UserProfile,
  AssessmentResult,
  DataLayer,
} from '@/types';

/**
 * Base repository interface with common CRUD operations
 */
export interface BaseRepository<T> {
  add(record: T): Promise<T>;
  update(record: T): Promise<T>;
  get(id: string): Promise<T | undefined>;
  delete(id: string): Promise<void>;
  getAll(): Promise<T[]>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

/**
 * Timeline Events Repository Interface
 */
export interface TimelineEventsRepository extends BaseRepository<TimelineEvent> {
  getByLayer(layer: DataLayer): Promise<TimelineEvent[]>;
  getBySource(source: string): Promise<TimelineEvent[]>;
  getBySourceId(sourceId: string): Promise<TimelineEvent | undefined>;
  getByDateRange(startDate: Date, endDate: Date): Promise<TimelineEvent[]>;
  addBatch(events: TimelineEvent[]): Promise<TimelineEvent[]>;
}

/**
 * Goals Repository Interface
 */
export interface GoalsRepository extends BaseRepository<Goal> {
  getByCategory(category: string): Promise<Goal[]>;
  getByStatus(status: string): Promise<Goal[]>;
  getActive(): Promise<Goal[]>;
  updateOrder(goals: Array<{ id: string; order: number }>): Promise<void>;
}

/**
 * User Profile Repository Interface
 */
export interface UserProfileRepository {
  get(): Promise<UserProfile | undefined>;
  save(profile: Omit<UserProfile, 'id'>): Promise<UserProfile>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;
}

/**
 * Assessments Repository Interface
 */
export interface AssessmentsRepository extends BaseRepository<AssessmentResult> {
  getByType(type: string): Promise<AssessmentResult[]>;
  getLatestByType(type: string): Promise<AssessmentResult | undefined>;
}

/**
 * Complete Database Adapter Interface
 * Any database implementation must provide all these repositories
 */
export interface DatabaseAdapter {
  readonly name: string;

  // Repositories
  timelineEvents: TimelineEventsRepository;
  goals: GoalsRepository;
  userProfile: UserProfileRepository;
  assessments: AssessmentsRepository;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Data management
  exportAllData(): Promise<DatabaseExport>;
  importData(data: DatabaseExport): Promise<void>;
  clearAllData(): Promise<void>;
}

/**
 * Export/Import data structure
 */
export interface DatabaseExport {
  events: TimelineEvent[];
  goals: Goal[];
  profile: UserProfile | undefined;
  assessments: AssessmentResult[];
  exportedAt: Date;
  version: string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  adapter: 'indexeddb' | 'memory' | 'api';
  apiUrl?: string;
  apiKey?: string;
}
