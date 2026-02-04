/**
 * iCal/ICS calendar file parser
 * Handles calendar exports from Google Calendar, Apple Calendar, Outlook, etc.
 */

import type { ImportResult, ImportError, ParsedEvent } from './types';
import type { DataLayer } from '@/types';
import { isZipFile, extractZip } from './zip';
import { MAX_FILE_SIZE, isValidFileSize, sanitizeString, truncateString } from './validation';

// Security limits for iCal parsing
const ICAL_MAX_LINE_LENGTH = 100_000; // 100KB per line (after unfolding)
const ICAL_MAX_EVENTS = 50_000; // Maximum events per file
const ICAL_MAX_PROPERTY_LENGTH = 50_000; // 50KB per property value

// iCal event structure
interface ICalEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  dtstart?: Date;
  dtend?: Date;
  allDay?: boolean;
  rrule?: string;
  categories?: string[];
  status?: string;
  organizer?: string;
  attendees?: string[];
}

/**
 * Parse iCal/ICS files
 */
export async function parseICalData(files: File[]): Promise<ImportResult> {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];
  let totalFiles = 0;
  let processedFiles = 0;

  const icsFiles: { file: File; path: string }[] = [];

  // Collect ICS files
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
      try {
        const extracted = await extractZip(file, (path) => {
          const lower = path.toLowerCase();
          return (lower.endsWith('.ics') || lower.endsWith('.ical')) && !lower.includes('__macosx');
        });
        icsFiles.push(...extracted.files.map(f => ({ file: f.file, path: f.path })));
        if (extracted.errors.length > 0) {
          errors.push(...extracted.errors.map(msg => ({ message: msg, file: file.name })));
        }
      } catch {
        errors.push({ message: 'Failed to extract ZIP', file: file.name });
      }
    } else if (file.name.toLowerCase().endsWith('.ics') || file.name.toLowerCase().endsWith('.ical')) {
      icsFiles.push({ file, path: file.name });
    }
  }

  totalFiles = icsFiles.length;

  // Parse each ICS file
  for (const { file, path } of icsFiles) {
    try {
      const text = await file.text();
      const parsed = parseICalText(text);

      for (const icalEvent of parsed.events) {
        const event = convertToTimelineEvent(icalEvent, path);
        if (event) {
          events.push(event);
        }
      }

      if (parsed.errors.length > 0) {
        errors.push(...parsed.errors.map(msg => ({ message: msg, file: path })));
      }

      processedFiles++;
    } catch {
      errors.push({ message: 'Failed to parse ICS file', file: path });
    }
  }

  // Calculate stats by layer
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
      skipped: errors.length,
    },
  };
}

/**
 * Parse iCal text content with security limits
 */
export function parseICalText(text: string): { events: ICalEvent[]; errors: string[] } {
  const events: ICalEvent[] = [];
  const errors: string[] = [];

  // Unfold lines (iCal allows line continuation with leading whitespace)
  // The continuation can be \r\n followed by space/tab, or just \n followed by space/tab
  const unfolded = text
    .replace(/\r\n/g, '\n')  // Normalize line endings first
    .replace(/\n[ \t]/g, '') // Unfold continuation lines
    .replace(/\r/g, '');     // Remove any remaining CR
  const lines = unfolded.split('\n');

  let currentEvent: ICalEvent | null = null;
  let inEvent = false;

  for (const line of lines) {
    // Skip lines that exceed the maximum length (security)
    if (line.length > ICAL_MAX_LINE_LENGTH) {
      errors.push(`Line exceeds maximum length of ${ICAL_MAX_LINE_LENGTH.toLocaleString()} characters`);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'BEGIN:VEVENT') {
      // Check if we've exceeded the event limit
      if (events.length >= ICAL_MAX_EVENTS) {
        errors.push(`Calendar exceeds maximum event limit of ${ICAL_MAX_EVENTS.toLocaleString()}`);
        break;
      }
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.dtstart) {
        events.push(currentEvent);
      }
      inEvent = false;
      currentEvent = null;
      continue;
    }

    if (!inEvent || !currentEvent) continue;

    // Parse property
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const propertyPart = trimmed.substring(0, colonIndex);
    let value = trimmed.substring(colonIndex + 1);

    // Truncate overly long property values (security)
    if (value.length > ICAL_MAX_PROPERTY_LENGTH) {
      value = value.substring(0, ICAL_MAX_PROPERTY_LENGTH);
    }

    // Extract property name and parameters
    const semicolonIndex = propertyPart.indexOf(';');
    const propertyName = semicolonIndex === -1 ? propertyPart : propertyPart.substring(0, semicolonIndex);
    const params = semicolonIndex === -1 ? '' : propertyPart.substring(semicolonIndex + 1);

    switch (propertyName.toUpperCase()) {
      case 'UID':
        currentEvent.uid = truncateString(value, 500);
        break;

      case 'SUMMARY':
        currentEvent.summary = truncateString(sanitizeString(unescapeICalValue(value)), 500);
        break;

      case 'DESCRIPTION':
        currentEvent.description = truncateString(sanitizeString(unescapeICalValue(value)), 10000);
        break;

      case 'LOCATION':
        currentEvent.location = truncateString(sanitizeString(unescapeICalValue(value)), 500);
        break;

      case 'DTSTART':
        const startResult = parseICalDateTime(value, params);
        currentEvent.dtstart = startResult.date;
        currentEvent.allDay = startResult.allDay;
        break;

      case 'DTEND':
        currentEvent.dtend = parseICalDateTime(value, params).date;
        break;

      case 'RRULE':
        currentEvent.rrule = truncateString(value, 500);
        break;

      case 'CATEGORIES':
        currentEvent.categories = value.split(',').map(c => truncateString(sanitizeString(unescapeICalValue(c.trim())), 100)).slice(0, 50);
        break;

      case 'STATUS':
        currentEvent.status = truncateString(value, 50);
        break;

      case 'ORGANIZER':
        // Extract email from "mailto:email@example.com"
        currentEvent.organizer = truncateString(value.replace(/^mailto:/i, ''), 200);
        break;

      case 'ATTENDEE':
        if (!currentEvent.attendees) currentEvent.attendees = [];
        if (currentEvent.attendees.length < 100) { // Limit attendees
          currentEvent.attendees.push(truncateString(value.replace(/^mailto:/i, ''), 200));
        }
        break;
    }
  }

  return { events, errors };
}

/**
 * Parse iCal date/time value with validation
 */
function parseICalDateTime(value: string, params: string): { date: Date | undefined; allDay: boolean } {
  // Check for VALUE=DATE parameter (all-day event)
  const allDay = params.toUpperCase().includes('VALUE=DATE') && !params.toUpperCase().includes('VALUE=DATE-TIME');

  // Parse the date value
  // Formats:
  // - 20230115 (DATE)
  // - 20230115T100000 (local DATE-TIME)
  // - 20230115T100000Z (UTC DATE-TIME)

  if (!value || value.length < 8) {
    return { date: undefined, allDay: false };
  }

  const year = parseInt(value.substring(0, 4), 10);
  const month = parseInt(value.substring(4, 6), 10) - 1;
  const day = parseInt(value.substring(6, 8), 10);

  // Validate parsed integers
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { date: undefined, allDay: false };
  }

  // Validate date ranges
  if (year < 1970 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
    return { date: undefined, allDay: false };
  }

  if (value.length === 8 || allDay) {
    // All-day event (DATE format)
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) {
      return { date: undefined, allDay: true };
    }
    return { date, allDay: true };
  }

  // DATE-TIME format
  if (value.length >= 15 && value[8] === 'T') {
    const hour = parseInt(value.substring(9, 11), 10);
    const minute = parseInt(value.substring(11, 13), 10);
    const second = parseInt(value.substring(13, 15), 10);

    // Validate time integers
    if (isNaN(hour) || isNaN(minute) || isNaN(second)) {
      return { date: undefined, allDay: false };
    }

    // Validate time ranges
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return { date: undefined, allDay: false };
    }

    let date: Date;
    if (value.endsWith('Z')) {
      // UTC time
      date = new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      // Local time or timezone-specific
      // Note: For simplicity, we treat timezone-specific times as local
      // A full implementation would use a timezone library
      date = new Date(year, month, day, hour, minute, second);
    }

    if (isNaN(date.getTime())) {
      return { date: undefined, allDay: false };
    }

    return { date, allDay: false };
  }

  return { date: undefined, allDay: false };
}

/**
 * Unescape iCal special characters
 */
function unescapeICalValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Convert iCal event to timeline event
 */
function convertToTimelineEvent(icalEvent: ICalEvent, sourcePath: string): ParsedEvent | null {
  if (!icalEvent.dtstart || !icalEvent.summary) {
    return null;
  }

  // Validate date range
  const year = icalEvent.dtstart.getFullYear();
  if (year < 1970 || year > 2100) {
    return null;
  }

  // Skip cancelled events
  if (icalEvent.status?.toUpperCase() === 'CANCELLED') {
    return null;
  }

  // Determine layer based on content
  let layer: DataLayer = 'media'; // Default to media for general events

  // Check for travel-related keywords in summary or location
  const travelKeywords = ['flight', 'airport', 'hotel', 'travel', 'trip', 'vacation', 'holiday'];
  const workKeywords = ['meeting', 'call', 'standup', 'review', 'interview', 'work', 'office', 'presentation'];
  const healthKeywords = ['doctor', 'dentist', 'appointment', 'gym', 'workout', 'therapy', 'medical'];
  const educationKeywords = ['class', 'lecture', 'course', 'exam', 'study', 'school', 'university'];

  const searchText = `${icalEvent.summary} ${icalEvent.description || ''} ${icalEvent.location || ''}`.toLowerCase();

  if (travelKeywords.some(kw => searchText.includes(kw)) || icalEvent.location) {
    layer = 'travel';
  } else if (workKeywords.some(kw => searchText.includes(kw))) {
    layer = 'work';
  } else if (healthKeywords.some(kw => searchText.includes(kw))) {
    layer = 'health';
  } else if (educationKeywords.some(kw => searchText.includes(kw))) {
    layer = 'education';
  }

  // Determine event type
  let eventType = 'event';
  if (icalEvent.allDay) {
    eventType = 'all_day_event';
  }
  if (icalEvent.rrule) {
    eventType = 'recurring_event';
  }

  return {
    title: icalEvent.summary,
    description: icalEvent.description,
    startDate: icalEvent.dtstart,
    endDate: icalEvent.dtend,
    layer,
    eventType,
    source: 'ical',
    sourceId: icalEvent.uid || `ical_${icalEvent.dtstart.getTime()}_${icalEvent.summary}`,
    location: icalEvent.location ? {
      name: icalEvent.location,
      latitude: 0,
      longitude: 0,
    } : undefined,
    metadata: {
      allDay: icalEvent.allDay,
      recurring: !!icalEvent.rrule,
      rrule: icalEvent.rrule,
      categories: icalEvent.categories,
      status: icalEvent.status,
      organizer: icalEvent.organizer,
      attendees: icalEvent.attendees,
      sourcePath,
    },
  };
}
