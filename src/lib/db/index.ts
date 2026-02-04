/**
 * Database Layer
 * Swappable database adapter for Personal Timeline
 *
 * This module provides a unified interface to the database layer.
 * The underlying storage can be switched between IndexedDB, Memory, or other adapters.
 */

import type { DatabaseAdapter } from './types';
import { IndexedDBAdapter } from './adapters/indexeddb';
import { MemoryAdapter } from './adapters/memory';

// Re-export types for convenience
export type { DatabaseAdapter, DatabaseExport } from './types';
export { IndexedDBAdapter } from './adapters/indexeddb';
export { MemoryAdapter } from './adapters/memory';

// Store names (kept for backwards compatibility)
export const STORES = {
  EVENTS: 'timeline-events',
  GOALS: 'goals',
  PROFILE: 'user-profile',
  ASSESSMENTS: 'assessments',
} as const;

/**
 * Determine if we're running in a browser environment with IndexedDB support
 */
function canUseIndexedDB(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Create the default adapter based on the environment
 */
function createDefaultAdapter(): DatabaseAdapter {
  if (canUseIndexedDB()) {
    return new IndexedDBAdapter();
  }
  // Fallback to memory adapter for SSR or environments without IndexedDB
  return new MemoryAdapter();
}

// Current active adapter
let currentAdapter: DatabaseAdapter = createDefaultAdapter();
let isInitialized = false;

/**
 * Get the current database adapter
 */
export function getAdapter(): DatabaseAdapter {
  return currentAdapter;
}

/**
 * Set a new database adapter
 * Useful for testing or switching storage backends
 */
export async function setAdapter(adapter: DatabaseAdapter): Promise<void> {
  // Close the current adapter if initialized
  if (isInitialized) {
    await currentAdapter.close();
  }

  currentAdapter = adapter;
  isInitialized = false;

  // Initialize the new adapter
  await initializeAdapter();
}

/**
 * Initialize the current adapter (called automatically on first use)
 */
async function initializeAdapter(): Promise<void> {
  if (!isInitialized) {
    await currentAdapter.initialize();
    isInitialized = true;
  }
}

/**
 * Ensure adapter is initialized before use
 */
async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    await initializeAdapter();
  }
}

// ============================================
// Backwards-Compatible API
// ============================================

/**
 * Timeline Events API
 * Proxies to the current adapter's timelineEvents repository
 */
export const timelineEvents = {
  async add(event: Parameters<DatabaseAdapter['timelineEvents']['add']>[0]) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.add(event);
  },
  async update(event: Parameters<DatabaseAdapter['timelineEvents']['update']>[0]) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.update(event);
  },
  async get(id: string) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.get(id);
  },
  async delete(id: string) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.delete(id);
  },
  async getAll() {
    await ensureInitialized();
    return currentAdapter.timelineEvents.getAll();
  },
  async clear() {
    await ensureInitialized();
    return currentAdapter.timelineEvents.clear();
  },
  async count() {
    await ensureInitialized();
    return currentAdapter.timelineEvents.count();
  },
  async getByLayer(layer: Parameters<DatabaseAdapter['timelineEvents']['getByLayer']>[0]) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.getByLayer(layer);
  },
  async getBySource(source: string) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.getBySource(source);
  },
  async getBySourceId(sourceId: string) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.getBySourceId(sourceId);
  },
  async getByDateRange(startDate: Date, endDate: Date) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.getByDateRange(startDate, endDate);
  },
  async addBatch(events: Parameters<DatabaseAdapter['timelineEvents']['addBatch']>[0]) {
    await ensureInitialized();
    return currentAdapter.timelineEvents.addBatch(events);
  },
};

/**
 * Goals API
 * Proxies to the current adapter's goals repository
 */
export const goals = {
  async add(goal: Parameters<DatabaseAdapter['goals']['add']>[0]) {
    await ensureInitialized();
    return currentAdapter.goals.add(goal);
  },
  async update(goal: Parameters<DatabaseAdapter['goals']['update']>[0]) {
    await ensureInitialized();
    return currentAdapter.goals.update(goal);
  },
  async get(id: string) {
    await ensureInitialized();
    return currentAdapter.goals.get(id);
  },
  async delete(id: string) {
    await ensureInitialized();
    return currentAdapter.goals.delete(id);
  },
  async getAll() {
    await ensureInitialized();
    return currentAdapter.goals.getAll();
  },
  async clear() {
    await ensureInitialized();
    return currentAdapter.goals.clear();
  },
  async count() {
    await ensureInitialized();
    return currentAdapter.goals.count();
  },
  async getByCategory(category: string) {
    await ensureInitialized();
    return currentAdapter.goals.getByCategory(category);
  },
  async getByStatus(status: string) {
    await ensureInitialized();
    return currentAdapter.goals.getByStatus(status);
  },
  async getActive() {
    await ensureInitialized();
    return currentAdapter.goals.getActive();
  },
  async updateOrder(goals: Array<{ id: string; order: number }>) {
    await ensureInitialized();
    return currentAdapter.goals.updateOrder(goals);
  },
};

/**
 * User Profile API
 * Proxies to the current adapter's userProfile repository
 */
export const userProfile = {
  async get() {
    await ensureInitialized();
    return currentAdapter.userProfile.get();
  },
  async save(profile: Parameters<DatabaseAdapter['userProfile']['save']>[0]) {
    await ensureInitialized();
    return currentAdapter.userProfile.save(profile);
  },
  async exists() {
    await ensureInitialized();
    return currentAdapter.userProfile.exists();
  },
  async delete() {
    await ensureInitialized();
    return currentAdapter.userProfile.delete();
  },
};

/**
 * Assessments API
 * Proxies to the current adapter's assessments repository
 */
export const assessments = {
  async add(assessment: Parameters<DatabaseAdapter['assessments']['add']>[0]) {
    await ensureInitialized();
    return currentAdapter.assessments.add(assessment);
  },
  async update(assessment: Parameters<DatabaseAdapter['assessments']['update']>[0]) {
    await ensureInitialized();
    return currentAdapter.assessments.update(assessment);
  },
  async get(id: string) {
    await ensureInitialized();
    return currentAdapter.assessments.get(id);
  },
  async delete(id: string) {
    await ensureInitialized();
    return currentAdapter.assessments.delete(id);
  },
  async getAll() {
    await ensureInitialized();
    return currentAdapter.assessments.getAll();
  },
  async clear() {
    await ensureInitialized();
    return currentAdapter.assessments.clear();
  },
  async count() {
    await ensureInitialized();
    return currentAdapter.assessments.count();
  },
  async getByType(type: string) {
    await ensureInitialized();
    return currentAdapter.assessments.getByType(type);
  },
  async getLatestByType(type: string) {
    await ensureInitialized();
    return currentAdapter.assessments.getLatestByType(type);
  },
};

// ============================================
// Database Utilities (Backwards Compatible)
// ============================================

/**
 * Initialize and open the database
 * @deprecated Use getAdapter().initialize() instead
 */
export async function openDatabase(): Promise<void> {
  await ensureInitialized();
}

/**
 * Close the database connection
 * @deprecated Use getAdapter().close() instead
 */
export async function closeDatabase(): Promise<void> {
  if (isInitialized) {
    await currentAdapter.close();
    isInitialized = false;
  }
}

/**
 * Export all data as JSON (for backup)
 */
export async function exportAllData() {
  await ensureInitialized();
  return currentAdapter.exportAllData();
}

/**
 * Import data from JSON backup
 */
export async function importData(data: Parameters<DatabaseAdapter['importData']>[0]): Promise<void> {
  await ensureInitialized();
  return currentAdapter.importData(data);
}

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  await ensureInitialized();
  return currentAdapter.clearAllData();
}

/**
 * Delete the entire database (IndexedDB only)
 * For other adapters, this clears all data
 */
export async function deleteDatabase(): Promise<void> {
  if (currentAdapter instanceof IndexedDBAdapter) {
    await closeDatabase();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('personal-timeline');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete database'));
    });
  }
  // For non-IndexedDB adapters, just clear the data
  await clearAllData();
}
