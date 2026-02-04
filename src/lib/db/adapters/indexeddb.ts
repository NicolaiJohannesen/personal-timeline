/**
 * IndexedDB Database Adapter
 * Local-first storage using browser IndexedDB
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

const DB_NAME = 'personal-timeline';
const DB_VERSION = 1;
const DEFAULT_USER_ID = 'default-user';

const STORES = {
  EVENTS: 'timeline-events',
  GOALS: 'goals',
  PROFILE: 'user-profile',
  ASSESSMENTS: 'assessments',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

/**
 * IndexedDB Adapter Implementation
 */
export class IndexedDBAdapter implements DatabaseAdapter {
  readonly name = 'indexeddb';
  private db: IDBDatabase | null = null;
  private isClosing = false;
  private openPromise: Promise<IDBDatabase> | null = null;

  // Repository instances
  timelineEvents: TimelineEventsRepository;
  goals: GoalsRepository;
  userProfile: UserProfileRepository;
  assessments: AssessmentsRepository;

  constructor() {
    this.timelineEvents = new IndexedDBTimelineEvents(this);
    this.goals = new IndexedDBGoals(this);
    this.userProfile = new IndexedDBUserProfile(this);
    this.assessments = new IndexedDBAssessments(this);
  }

  async initialize(): Promise<void> {
    await this.openDatabase();
  }

  async close(): Promise<void> {
    this.isClosing = true;
    const dbToClose = this.db;
    this.db = null;
    this.openPromise = null;
    if (dbToClose) {
      dbToClose.close();
    }
    this.isClosing = false;
  }

  async getDatabase(): Promise<IDBDatabase> {
    // If we have a valid open database, verify it's still usable
    if (this.db && !this.isClosing) {
      // Check if the database connection is still valid
      try {
        // Test by creating a dummy transaction - this will fail if connection is closing
        const tx = this.db.transaction(STORES.PROFILE, 'readonly');
        tx.abort(); // Immediately abort the test transaction
        return this.db;
      } catch {
        // Database is no longer valid, clear it and reconnect
        this.db = null;
        this.openPromise = null;
      }
    }

    // If already opening, wait for that promise
    if (this.openPromise) {
      return this.openPromise;
    }

    // Open a new connection
    return this.openDatabase();
  }

  private async openDatabase(): Promise<IDBDatabase> {
    // Use a shared promise to prevent multiple concurrent opens
    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.openPromise = null;
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.openPromise = null;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.EVENTS)) {
          const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
          eventsStore.createIndex('userId', 'userId', { unique: false });
          eventsStore.createIndex('layer', 'layer', { unique: false });
          eventsStore.createIndex('startDate', 'startDate', { unique: false });
          eventsStore.createIndex('source', 'source', { unique: false });
          eventsStore.createIndex('sourceId', 'sourceId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.GOALS)) {
          const goalsStore = db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
          goalsStore.createIndex('userId', 'userId', { unique: false });
          goalsStore.createIndex('category', 'category', { unique: false });
          goalsStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PROFILE)) {
          db.createObjectStore(STORES.PROFILE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.ASSESSMENTS)) {
          const assessmentsStore = db.createObjectStore(STORES.ASSESSMENTS, { keyPath: 'id' });
          assessmentsStore.createIndex('userId', 'userId', { unique: false });
          assessmentsStore.createIndex('assessmentType', 'assessmentType', { unique: false });
        }
      };
    });

    return this.openPromise;
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
    // Validate data structure before importing
    const validation = validateDatabaseExport(data);
    if (!validation.valid) {
      const errorMessages = validation.errors.slice(0, 5).map(e => e.message).join('; ');
      throw new Error(`Import validation failed: ${errorMessages}${validation.errors.length > 5 ? ` (and ${validation.errors.length - 5} more errors)` : ''}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Import warnings:', validation.warnings);
    }

    // Import events with batch operation
    if (data.events && data.events.length > 0) {
      await this.timelineEvents.addBatch(data.events);
    }

    // Import goals one by one (could be improved with batch)
    if (data.goals && data.goals.length > 0) {
      for (const goal of data.goals) {
        await this.goals.add(goal);
      }
    }

    // Import profile
    if (data.profile) {
      await this.userProfile.save(data.profile);
    }

    // Import assessments one by one
    if (data.assessments && data.assessments.length > 0) {
      for (const assessment of data.assessments) {
        await this.assessments.add(assessment);
      }
    }
  }

  async clearAllData(): Promise<void> {
    await this.timelineEvents.clear();
    await this.goals.clear();
    await this.userProfile.delete();
    await this.assessments.clear();
  }
}

/**
 * Helper class for common IndexedDB operations
 */
class IndexedDBStore<T> {
  constructor(
    protected adapter: IndexedDBAdapter,
    protected storeName: StoreName
  ) {}

  protected async add(record: T): Promise<T> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(new Error(`Failed to add record: ${request.error?.message}`));
    });
  }

  protected async update(record: T): Promise<T> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(new Error(`Failed to update record: ${request.error?.message}`));
    });
  }

  protected async get(id: string): Promise<T | undefined> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(new Error(`Failed to get record: ${request.error?.message}`));
    });
  }

  protected async deleteRecord(id: string): Promise<void> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete record: ${request.error?.message}`));
    });
  }

  protected async getAll(): Promise<T[]> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(new Error(`Failed to get all records: ${request.error?.message}`));
    });
  }

  protected async getByIndex(indexName: string, value: IDBValidKey): Promise<T[]> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(new Error(`Failed to get records by index: ${request.error?.message}`));
    });
  }

  protected async clear(): Promise<void> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear store: ${request.error?.message}`));
    });
  }

  protected async count(): Promise<number> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count records: ${request.error?.message}`));
    });
  }
}

/**
 * Timeline Events Repository Implementation
 */
class IndexedDBTimelineEvents
  extends IndexedDBStore<TimelineEvent>
  implements TimelineEventsRepository
{
  constructor(adapter: IndexedDBAdapter) {
    super(adapter, STORES.EVENTS);
  }

  add = (event: TimelineEvent) => super.add(event);
  update = (event: TimelineEvent) => super.update(event);
  get = (id: string) => super.get(id);
  delete = (id: string) => super.deleteRecord(id);
  getAll = () => super.getAll();
  clear = () => super.clear();
  count = () => super.count();

  getByLayer = (layer: DataLayer) => super.getByIndex('layer', layer);
  getBySource = (source: string) => super.getByIndex('source', source);

  async getBySourceId(sourceId: string): Promise<TimelineEvent | undefined> {
    const results = await super.getByIndex('sourceId', sourceId);
    return results[0];
  }

  async getByDateRange(startDate: Date, endDate: Date): Promise<TimelineEvent[]> {
    // IndexedDB stores dates as-is, so we need to filter manually for reliable cross-type comparison
    const allEvents = await this.getAll();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    return allEvents.filter((event) => {
      const eventTime = new Date(event.startDate).getTime();
      return eventTime >= startTime && eventTime <= endTime;
    });
  }

  async addBatch(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    if (events.length === 0) {
      return [];
    }

    const db = await this.adapter.getDatabase();
    const addedEvents: TimelineEvent[] = [];
    const errors: { event: TimelineEvent; error: string }[] = [];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.EVENTS, 'readwrite');
      const store = transaction.objectStore(STORES.EVENTS);

      transaction.oncomplete = () => {
        if (errors.length > 0) {
          console.warn(`Batch add completed with ${errors.length} errors:`, errors);
        }
        resolve(addedEvents);
      };

      transaction.onerror = () => {
        const errorMsg = transaction.error?.message || 'Unknown transaction error';
        reject(new Error(`Batch add failed: ${errorMsg}. Added ${addedEvents.length}/${events.length} events.`));
      };

      // Use 'put' instead of 'add' to allow upserts (update if exists)
      for (const event of events) {
        try {
          const request = store.put(event);
          request.onsuccess = () => {
            addedEvents.push(event);
          };
          request.onerror = () => {
            const errorMsg = request.error?.message || 'Unknown error';
            errors.push({ event, error: errorMsg });
            // Prevent the error from aborting the transaction
            request.onerror = null;
          };
        } catch (err) {
          errors.push({
            event,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    });
  }
}

/**
 * Goals Repository Implementation
 */
class IndexedDBGoals extends IndexedDBStore<Goal> implements GoalsRepository {
  constructor(adapter: IndexedDBAdapter) {
    super(adapter, STORES.GOALS);
  }

  add = (goal: Goal) => super.add(goal);
  update = (goal: Goal) => super.update(goal);
  get = (id: string) => super.get(id);
  delete = (id: string) => super.deleteRecord(id);
  getAll = () => super.getAll();
  clear = () => super.clear();
  count = () => super.count();

  getByCategory = (category: string) => super.getByIndex('category', category);
  getByStatus = (status: string) => super.getByIndex('status', status);

  async getActive(): Promise<Goal[]> {
    const allGoals = await super.getAll();
    return allGoals.filter(
      (goal) => goal.status === 'not_started' || goal.status === 'in_progress'
    );
  }

  async updateOrder(goals: Array<{ id: string; order: number }>): Promise<void> {
    if (goals.length === 0) return;

    const db = await this.adapter.getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.GOALS, 'readwrite');
      const store = transaction.objectStore(STORES.GOALS);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Failed to update order: ${transaction.error?.message}`));

      // Batch update: get each goal, update order, and put back
      for (const { id, order } of goals) {
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const goal = getRequest.result as Goal | undefined;
          if (goal) {
            goal.order = order;
            goal.updatedAt = new Date();
            store.put(goal);
          }
        };
      }
    });
  }
}

/**
 * User Profile Repository Implementation
 */
class IndexedDBUserProfile implements UserProfileRepository {
  constructor(private adapter: IndexedDBAdapter) {}

  async get(): Promise<UserProfile | undefined> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROFILE, 'readonly');
      const store = transaction.objectStore(STORES.PROFILE);
      const request = store.get(DEFAULT_USER_ID);

      request.onsuccess = () => resolve(request.result as UserProfile | undefined);
      request.onerror = () => reject(new Error(`Failed to get profile: ${request.error?.message}`));
    });
  }

  async save(profile: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const db = await this.adapter.getDatabase();
    const fullProfile: UserProfile = { ...profile, id: DEFAULT_USER_ID };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROFILE, 'readwrite');
      const store = transaction.objectStore(STORES.PROFILE);
      const request = store.put(fullProfile);

      request.onsuccess = () => resolve(fullProfile);
      request.onerror = () => reject(new Error(`Failed to save profile: ${request.error?.message}`));
    });
  }

  async exists(): Promise<boolean> {
    const profile = await this.get();
    return profile !== undefined;
  }

  async delete(): Promise<void> {
    const db = await this.adapter.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROFILE, 'readwrite');
      const store = transaction.objectStore(STORES.PROFILE);
      const request = store.delete(DEFAULT_USER_ID);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete profile: ${request.error?.message}`));
    });
  }
}

/**
 * Assessments Repository Implementation
 */
class IndexedDBAssessments
  extends IndexedDBStore<AssessmentResult>
  implements AssessmentsRepository
{
  constructor(adapter: IndexedDBAdapter) {
    super(adapter, STORES.ASSESSMENTS);
  }

  add = (assessment: AssessmentResult) => super.add(assessment);
  update = (assessment: AssessmentResult) => super.update(assessment);
  get = (id: string) => super.get(id);
  delete = (id: string) => super.deleteRecord(id);
  getAll = () => super.getAll();
  clear = () => super.clear();
  count = () => super.count();

  getByType = (type: string) => super.getByIndex('assessmentType', type);

  async getLatestByType(type: string): Promise<AssessmentResult | undefined> {
    const results = await this.getByType(type);
    if (results.length === 0) return undefined;
    return results.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )[0];
  }
}
