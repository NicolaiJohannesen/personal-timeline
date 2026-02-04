/**
 * Unified date parser for import sources
 * Consolidates date parsing logic from various import formats
 */

import { createValidDate, isValidYear, isValidMonth, isValidDay, isValidTimestamp, timestampToDate } from './validation';

/**
 * Month name to number mapping (0-indexed for JavaScript Date)
 */
const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse options for date parsing
 */
export interface DateParseOptions {
  /** Prefer US date format (MM/DD/YYYY) over EU (DD/MM/YYYY) */
  preferUSFormat?: boolean;
  /** Default timezone offset in minutes (unused for now) */
  timezoneOffset?: number;
}

/**
 * Parse a date string in various formats
 * Supports: ISO 8601, US format, EU format, "Mon YYYY", "YYYY" only
 */
export function parseDate(dateStr: string | null | undefined, options: DateParseOptions = {}): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  // Try ISO format first (most reliable)
  const isoResult = parseISODate(trimmed);
  if (isoResult) return isoResult;

  // Try various date formats
  const slashResult = parseSlashDate(trimmed, options.preferUSFormat ?? true);
  if (slashResult) return slashResult;

  const dashDotResult = parseDashDotDate(trimmed);
  if (dashDotResult) return dashDotResult;

  const monthYearResult = parseMonthYearDate(trimmed);
  if (monthYearResult) return monthYearResult;

  const yearOnlyResult = parseYearOnly(trimmed);
  if (yearOnlyResult) return yearOnlyResult;

  return null;
}

/**
 * Parse ISO 8601 format dates
 * Examples: "2024-06-15", "2024-06-15T14:30:00", "2024-06-15T14:30:00Z"
 */
export function parseISODate(dateStr: string): Date | null {
  // Only accept actual ISO format strings to avoid Date() auto-correction
  // ISO formats: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS with optional timezone
  const isoMatch = dateStr.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
  );

  if (!isoMatch) {
    return null;
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = isoMatch;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = hourStr ? parseInt(hourStr, 10) : 0;
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;
  const second = secondStr ? parseInt(secondStr, 10) : 0;

  // For dates with timezone info, use native parsing but validate first
  if (dateStr.includes('T') && (dateStr.includes('Z') || dateStr.includes('+') || dateStr.match(/-\d{2}:\d{2}$/))) {
    // Validate components first
    if (!isValidYear(year) || !isValidMonth(month) || !isValidDay(day, month, year)) {
      return null;
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    return null;
  }

  // For local dates without timezone, create date manually
  return createValidDate(year, month, day, hour, minute, second);
}

/**
 * Parse dates with slashes: MM/DD/YYYY or DD/MM/YYYY
 */
export function parseSlashDate(dateStr: string, preferUS = true): Date | null {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, first, second, yearStr] = match;
  const year = parseInt(yearStr, 10);

  if (!isValidYear(year)) return null;

  // Determine which is month and which is day
  const firstNum = parseInt(first, 10);
  const secondNum = parseInt(second, 10);

  let month: number;
  let day: number;

  if (preferUS) {
    // US format: MM/DD/YYYY
    month = firstNum;
    day = secondNum;
  } else {
    // EU format: DD/MM/YYYY
    day = firstNum;
    month = secondNum;
  }

  // Validate and create date
  return createValidDate(year, month, day);
}

/**
 * Parse dates with dashes or dots: DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
 */
export function parseDashDotDate(dateStr: string): Date | null {
  // Try YYYY-MM-DD format first
  const isoShortMatch = dateStr.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})$/);
  if (isoShortMatch) {
    const [, yearStr, monthStr, dayStr] = isoShortMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    return createValidDate(year, month, day);
  }

  // Try DD-MM-YYYY or DD.MM.YYYY format
  const euMatch = dateStr.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (euMatch) {
    const [, dayStr, monthStr, yearStr] = euMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    return createValidDate(year, month, day);
  }

  return null;
}

/**
 * Parse "Mon YYYY" or "Month YYYY" format (LinkedIn style)
 */
export function parseMonthYearDate(dateStr: string): Date | null {
  const match = dateStr.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const [, monthName, yearStr] = match;
  const year = parseInt(yearStr, 10);

  if (!isValidYear(year)) return null;

  const month = MONTH_NAMES[monthName.toLowerCase()];
  if (month === undefined) return null;

  // Return first day of the month
  return createValidDate(year, month + 1, 1);
}

/**
 * Parse year-only format
 */
export function parseYearOnly(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  if (!isValidYear(year)) return null;

  // Return first day of the year
  return createValidDate(year, 1, 1);
}

/**
 * Parse Unix timestamp (seconds or milliseconds)
 * Automatically detects if timestamp is in seconds or milliseconds
 */
export function parseTimestamp(timestamp: number | string): Date | null {
  let ts: number;

  if (typeof timestamp === 'string') {
    ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return null;
  } else {
    ts = timestamp;
  }

  if (!Number.isFinite(ts) || ts < 0) {
    return null;
  }

  // Detect if milliseconds (13 digits) or seconds (10 digits)
  const isMilliseconds = ts > 9999999999;

  return timestampToDate(ts, isMilliseconds);
}

/**
 * Extract date from a file path (for media imports)
 * Looks for date patterns in folder/file names
 */
export function extractDateFromPath(path: string): Date | null {
  if (!path) return null;

  // Patterns to try, in order of specificity
  const patterns = [
    // ISO-like: 2023-01-15 or 2023_01_15 with optional time
    /(\d{4})[-_](\d{2})[-_](\d{2})(?:[-_T](\d{2})[-_:](\d{2})(?:[-_:](\d{2}))?)?/,
    // Year-month: 2023-01 or 2023_01 (followed by separator, slash, or end)
    /(\d{4})[-_](\d{2})(?:[-_\/]|$)/,
    // Just year in folder name
    /\/(\d{4})\//,
  ];

  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = match[2] ? parseInt(match[2], 10) : 1;
      const day = match[3] ? parseInt(match[3], 10) : 1;
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      const second = match[6] ? parseInt(match[6], 10) : 0;

      const date = createValidDate(year, month, day, hour, minute, second);
      if (date) return date;
    }
  }

  // Try timestamp patterns (common in social media exports)
  const timestampPatterns = [
    // Millisecond timestamp: 1234567890123
    /(\d{13})/,
    // Second timestamp: 1234567890
    /(\d{10})/,
  ];

  for (const pattern of timestampPatterns) {
    const match = path.match(pattern);
    if (match) {
      const ts = parseInt(match[1], 10);
      const date = parseTimestamp(ts);
      if (date) return date;
    }
  }

  return null;
}

/**
 * Parse EXIF-style date string (YYYY:MM:DD HH:MM:SS)
 */
export function parseExifDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length < 19) return null;

  const match = dateStr.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);

  return createValidDate(year, month, day, hour, minute, second);
}

/**
 * Parse iCal date/time format (YYYYMMDD or YYYYMMDDTHHMMSS)
 */
export function parseICalDate(value: string, isAllDay = false): Date | null {
  if (!value || value.length < 8) {
    return null;
  }

  const year = parseInt(value.substring(0, 4), 10);
  const month = parseInt(value.substring(4, 6), 10);
  const day = parseInt(value.substring(6, 8), 10);

  if (!isValidYear(year) || !isValidMonth(month) || !isValidDay(day, month, year)) {
    return null;
  }

  // All-day event or DATE format
  if (value.length === 8 || isAllDay) {
    return createValidDate(year, month, day);
  }

  // DATE-TIME format: YYYYMMDDTHHMMSS
  if (value.length >= 15 && value[8] === 'T') {
    const hour = parseInt(value.substring(9, 11), 10);
    const minute = parseInt(value.substring(11, 13), 10);
    const second = parseInt(value.substring(13, 15), 10);

    if (value.endsWith('Z')) {
      // UTC time
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      return isValidYear(utcDate.getFullYear()) ? utcDate : null;
    }

    // Local time
    return createValidDate(year, month, day, hour, minute, second);
  }

  return null;
}

/**
 * Get the best available date, preferring more specific ones
 * Useful for combining multiple date fields (like EXIF dateTimeOriginal vs dateTime)
 */
export function getBestDate(...dates: (Date | null | undefined)[]): Date | null {
  for (const date of dates) {
    if (date && !isNaN(date.getTime()) && isValidYear(date.getFullYear())) {
      return date;
    }
  }
  return null;
}
