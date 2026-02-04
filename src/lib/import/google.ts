// Google Takeout data import parser

import type {
  ImportResult,
  ImportError,
  ParsedEvent,
  GoogleLocation,
  GoogleCalendarEvent,
  GoogleKeepNote,
} from './types';
import type { DataLayer } from '@/types';
import { isZipFile, extractJsonFiles } from './zip';
import { MAX_FILE_SIZE, isValidFileSize, sanitizeString, truncateString } from './validation';

interface GoogleExport {
  locations?: GoogleLocation[];
  calendar?: GoogleCalendarEvent[];
  keep?: GoogleKeepNote[];
}

// Security limits to prevent memory exhaustion
const MAX_LOCATIONS = 100_000; // Max location points to process
const MAX_CALENDAR_EVENTS = 50_000; // Max calendar events
const MAX_KEEP_NOTES = 10_000; // Max Keep notes
const MAX_STRING_LENGTH = 10_000; // Max description length
const MAX_TITLE_LENGTH = 500; // Max title length

// File extensions that we can parse
const SUPPORTED_EXTENSIONS = ['.json'];

// File extensions to silently ignore (common in Google Takeout but not parseable)
const IGNORED_EXTENSIONS = ['.html', '.htm', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mp3', '.pdf'];

/**
 * Check if a file should be skipped based on extension
 */
function shouldSkipFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return IGNORED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * Check if a file is a supported JSON file
 */
function isSupportedFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * Check if JSON data looks like a Google Keep note
 * Keep notes have specific fields like timestamps in microseconds
 */
function isKeepNote(data: unknown): data is GoogleKeepNote {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Keep notes have microsecond timestamps
  const hasKeepTimestamp =
    typeof obj.createdTimestampUsec === 'number' ||
    typeof obj.userEditedTimestampUsec === 'number';

  // Keep notes have content (text or list)
  const hasContent =
    typeof obj.textContent === 'string' ||
    Array.isArray(obj.listContent) ||
    typeof obj.title === 'string';

  return hasKeepTimestamp && hasContent;
}

/**
 * Check if JSON data is an array of Keep notes
 */
function isKeepNoteArray(data: unknown): data is GoogleKeepNote[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  // Check if first item looks like a Keep note
  return isKeepNote(data[0]);
}

/**
 * Check if JSON data looks like location history
 */
function isLocationHistory(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.locations) ||
         Array.isArray(obj.semanticSegments) ||
         Array.isArray(obj.timelineObjects);
}

/**
 * Check if JSON data looks like calendar data
 */
function isCalendarData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  // Array of events with summary/start
  if (Array.isArray(data)) {
    return data.length > 0 && data.some(item =>
      item && typeof item === 'object' && ('summary' in item || 'start' in item)
    );
  }

  // Object with items array
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.items)) {
    return obj.items.some(item =>
      item && typeof item === 'object' && ('summary' in item || 'start' in item)
    );
  }

  return false;
}

/**
 * Parse Google Takeout data export
 * Supports both individual JSON files and ZIP archives
 */
export async function parseGoogleData(
  files: File[]
): Promise<ImportResult> {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];
  let processedFiles = 0;
  let skippedFiles = 0;

  // Extract any ZIP files first
  const filesToProcess: File[] = [];
  for (const file of files) {
    // Validate file size before processing
    if (!isValidFileSize(file.size)) {
      const sizeMB = Math.round(file.size / (1024 * 1024));
      const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
      errors.push({
        file: file.name,
        message: `File too large (${sizeMB}MB). Maximum allowed size is ${maxMB}MB.`,
      });
      continue;
    }

    if (isZipFile(file)) {
      const extracted = await extractJsonFiles(file);
      filesToProcess.push(...extracted.files.map(f => f.file));
      errors.push(...extracted.errors.map(msg => ({ message: msg, file: file.name })));
    } else {
      filesToProcess.push(file);
    }
  }

  const totalFiles = filesToProcess.length;

  for (const file of filesToProcess) {
    const fileName = file.name.toLowerCase();

    // Skip unsupported file types silently (HTML, images, etc.)
    if (shouldSkipFile(fileName)) {
      skippedFiles++;
      continue;
    }

    // Skip non-JSON files silently
    if (!isSupportedFile(fileName)) {
      skippedFiles++;
      continue;
    }

    try {
      const content = await file.text();

      // Try to parse as JSON, skip if invalid
      let jsonData: unknown;
      try {
        jsonData = JSON.parse(content);
      } catch {
        // Not valid JSON, skip silently
        skippedFiles++;
        continue;
      }

      // Detect data type by content structure, not just filename
      let parsed = false;

      // Check for Keep note by structure (most common in Takeout)
      if (isKeepNote(jsonData)) {
        const result = parseKeepNotes([jsonData as GoogleKeepNote]);
        events.push(...result.events);
        errors.push(...result.errors);
        processedFiles++;
        parsed = true;
      }
      // Check for array of Keep notes
      else if (isKeepNoteArray(jsonData)) {
        const result = parseKeepNotes(jsonData);
        events.push(...result.events);
        errors.push(...result.errors);
        processedFiles++;
        parsed = true;
      }
      // Check for location history by structure or filename
      else if (isLocationHistory(jsonData) ||
               fileName.includes('location') ||
               fileName.includes('semantic') ||
               fileName.includes('timeline')) {
        const result = parseLocationHistory(jsonData as { locations?: GoogleLocation[]; semanticSegments?: unknown[]; timelineObjects?: unknown[] });
        events.push(...result.events);
        errors.push(...result.errors);
        processedFiles++;
        parsed = true;
      }
      // Check for calendar by structure or filename
      else if (isCalendarData(jsonData) || fileName.includes('calendar')) {
        const result = parseCalendar(jsonData as GoogleCalendarEvent[] | { items?: GoogleCalendarEvent[] });
        events.push(...result.events);
        errors.push(...result.errors);
        processedFiles++;
        parsed = true;
      }

      if (!parsed) {
        // JSON file but doesn't match known patterns - skip silently
        skippedFiles++;
      }
    } catch (error) {
      // Only add errors for actual parsing failures, not for skipped files
      errors.push({
        file: file.name,
        message: error instanceof Error ? error.message : 'Failed to parse file',
      });
    }
  }

  // Calculate stats
  const eventsByLayer: Partial<Record<DataLayer, number>> = {};
  for (const event of events) {
    eventsByLayer[event.layer] = (eventsByLayer[event.layer] || 0) + 1;
  }

  return {
    events,
    errors,
    stats: {
      totalFiles,
      processedFiles,
      totalEvents: events.length,
      eventsByLayer,
      skipped: skippedFiles + errors.length,
    },
  };
}

/**
 * Parse Google data from pre-parsed object
 */
export function parseGoogleObject(data: GoogleExport): {
  events: ParsedEvent[];
  errors: ImportError[];
} {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  // Parse locations
  if (data.locations) {
    const locationResult = parseLocationHistory({ locations: data.locations });
    events.push(...locationResult.events);
    errors.push(...locationResult.errors);
  }

  // Parse calendar
  if (data.calendar) {
    const calendarResult = parseCalendar(data.calendar);
    events.push(...calendarResult.events);
    errors.push(...calendarResult.errors);
  }

  // Parse keep notes
  if (data.keep) {
    const keepResult = parseKeepNotes(data.keep);
    events.push(...keepResult.events);
    errors.push(...keepResult.errors);
  }

  return { events, errors };
}

function parseLocationHistory(data: {
  locations?: GoogleLocation[];
  semanticSegments?: unknown[];
  timelineObjects?: unknown[];
}): { events: ParsedEvent[]; errors: ImportError[] } {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  // Parse raw locations (older format) with limit
  const allLocations = data.locations || [];
  const locations = allLocations.slice(0, MAX_LOCATIONS);

  if (allLocations.length > MAX_LOCATIONS) {
    errors.push({
      message: `Location history truncated: ${allLocations.length} locations found, processing first ${MAX_LOCATIONS}`,
    });
  }

  // Group locations by day for significant places
  const locationsByDay = new Map<string, GoogleLocation[]>();

  for (const loc of locations) {
    if (!loc.timestampMs || !loc.latitudeE7 || !loc.longitudeE7) continue;

    // Validate timestamp - could be string or number
    const timestampMs = typeof loc.timestampMs === 'string'
      ? parseInt(loc.timestampMs, 10)
      : loc.timestampMs;

    if (isNaN(timestampMs) || timestampMs < 0) continue;

    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) continue;

    // Validate year is reasonable
    const year = date.getFullYear();
    if (year < 1990 || year > 2100) continue;

    const dayKey = date.toISOString().split('T')[0];

    const existingLocs = locationsByDay.get(dayKey);
    if (existingLocs) {
      existingLocs.push(loc);
    } else {
      locationsByDay.set(dayKey, [loc]);
    }
  }

  // Create events for days with significant location changes
  for (const [dayKey, dayLocations] of locationsByDay) {
    if (dayLocations.length < 1) continue;

    // Use the first location of the day as representative
    const firstLoc = dayLocations[0];
    // Safe to use values directly since we filtered out null/undefined above
    const lat = (firstLoc.latitudeE7 ?? 0) / 1e7;
    const lng = (firstLoc.longitudeE7 ?? 0) / 1e7;

    try {
      events.push({
        title: `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        startDate: new Date(dayKey),
        layer: 'travel',
        eventType: 'location',
        source: 'google',
        sourceId: `google_loc_${dayKey}`,
        location: {
          latitude: lat,
          longitude: lng,
        },
        metadata: {
          pointCount: dayLocations.length,
        },
      });
    } catch (error) {
      errors.push({
        message: 'Failed to parse location day',
        data: { dayKey, count: dayLocations.length },
      });
    }
  }

  return { events, errors };
}

function parseCalendar(data: GoogleCalendarEvent[] | { items?: GoogleCalendarEvent[] }): {
  events: ParsedEvent[];
  errors: ImportError[];
} {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  const allCalendarEvents = Array.isArray(data) ? data : (data.items || []);
  const calendarEvents = allCalendarEvents.slice(0, MAX_CALENDAR_EVENTS);

  if (allCalendarEvents.length > MAX_CALENDAR_EVENTS) {
    errors.push({
      message: `Calendar events truncated: ${allCalendarEvents.length} events found, processing first ${MAX_CALENDAR_EVENTS}`,
    });
  }

  for (const event of calendarEvents) {
    try {
      const parsed = parseCalendarEvent(event);
      if (parsed) events.push(parsed);
    } catch (error) {
      errors.push({
        message: 'Failed to parse calendar event',
        data: event,
      });
    }
  }

  return { events, errors };
}

function parseCalendarEvent(event: GoogleCalendarEvent): ParsedEvent | null {
  if (!event.summary || typeof event.summary !== 'string') return null;

  const startDateStr = event.start?.dateTime || event.start?.date;
  if (!startDateStr) return null;

  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return null;

  // Validate year is reasonable
  const year = startDate.getFullYear();
  if (year < 1900 || year > 2100) return null;

  const endDateStr = event.end?.dateTime || event.end?.date;
  let endDate: Date | undefined;
  if (endDateStr) {
    const parsedEnd = new Date(endDateStr);
    if (!isNaN(parsedEnd.getTime()) && parsedEnd.getTime() !== startDate.getTime()) {
      endDate = parsedEnd;
    }
  }

  // Sanitize and truncate strings
  const title = truncateString(sanitizeString(event.summary), MAX_TITLE_LENGTH);
  const description = event.description
    ? truncateString(sanitizeString(event.description), MAX_STRING_LENGTH)
    : undefined;

  // Determine layer based on event content
  const titleLower = title.toLowerCase();
  let layer: DataLayer = 'media';
  let eventType = 'calendar_event';

  if (
    titleLower.includes('flight') ||
    titleLower.includes('hotel') ||
    titleLower.includes('trip') ||
    titleLower.includes('vacation')
  ) {
    layer = 'travel';
    eventType = 'trip';
  } else if (
    titleLower.includes('meeting') ||
    titleLower.includes('interview') ||
    titleLower.includes('work')
  ) {
    layer = 'work';
    eventType = 'meeting';
  } else if (
    titleLower.includes('doctor') ||
    titleLower.includes('dentist') ||
    titleLower.includes('gym') ||
    titleLower.includes('workout')
  ) {
    layer = 'health';
    eventType = 'appointment';
  } else if (
    titleLower.includes('birthday') ||
    titleLower.includes('dinner') ||
    titleLower.includes('lunch') ||
    titleLower.includes('party')
  ) {
    layer = 'relationships';
    eventType = 'social';
  }

  // Create safe sourceId without special characters
  const safeTitle = title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_');

  return {
    title,
    description,
    startDate,
    endDate,
    layer,
    eventType,
    source: 'google',
    sourceId: `google_cal_${startDate.getTime()}_${safeTitle}`,
    location: event.location
      ? { name: truncateString(sanitizeString(event.location), 200), latitude: 0, longitude: 0 }
      : undefined,
  };
}

function parseKeepNotes(notes: GoogleKeepNote[]): {
  events: ParsedEvent[];
  errors: ImportError[];
} {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  const notesToProcess = notes.slice(0, MAX_KEEP_NOTES);

  if (notes.length > MAX_KEEP_NOTES) {
    errors.push({
      message: `Keep notes truncated: ${notes.length} notes found, processing first ${MAX_KEEP_NOTES}`,
    });
  }

  for (const note of notesToProcess) {
    try {
      const parsed = parseKeepNote(note);
      if (parsed) events.push(parsed);
    } catch (error) {
      errors.push({
        message: 'Failed to parse keep note',
        data: note,
      });
    }
  }

  return { events, errors };
}

function parseKeepNote(note: GoogleKeepNote): ParsedEvent | null {
  // Skip trashed notes
  if (note.isTrashed) return null;

  // Get text content - either from textContent or by joining listContent items
  let textContent = note.textContent;
  if (!textContent && note.listContent) {
    // Limit list items to prevent memory issues
    const items = note.listContent.slice(0, 1000);
    textContent = items
      .map((item) => {
        const prefix = item.isChecked ? '☑ ' : '☐ ';
        const text = typeof item.text === 'string' ? item.text : '';
        return prefix + text;
      })
      .join('\n');
  }

  if (!note.title && !textContent) return null;

  const timestamp = note.userEditedTimestampUsec || note.createdTimestampUsec;
  if (!timestamp || typeof timestamp !== 'number') return null;

  // Validate timestamp is positive and reasonable
  if (timestamp < 0 || timestamp > Number.MAX_SAFE_INTEGER) return null;

  // Convert microseconds to milliseconds
  const date = new Date(timestamp / 1000);
  if (isNaN(date.getTime())) return null;

  // Validate year is reasonable
  const year = date.getFullYear();
  if (year < 1990 || year > 2100) return null;

  // Sanitize and truncate strings
  const rawTitle = note.title || (textContent ? textContent.slice(0, 100) : '');
  const title = truncateString(sanitizeString(rawTitle), MAX_TITLE_LENGTH);

  if (!title) return null;

  const description = textContent
    ? truncateString(sanitizeString(textContent), MAX_STRING_LENGTH)
    : undefined;

  // Sanitize labels
  const labels = note.labels
    ?.slice(0, 50) // Limit number of labels
    .map((l) => sanitizeString(l.name || ''))
    .filter((name) => name.length > 0);

  return {
    title,
    description,
    startDate: date,
    layer: 'media',
    eventType: note.listContent ? 'checklist' : 'note',
    source: 'google',
    sourceId: `google_keep_${timestamp}`,
    metadata: {
      labels: labels && labels.length > 0 ? labels : undefined,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
    },
  };
}
