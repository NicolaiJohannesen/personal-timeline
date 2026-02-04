/**
 * Validation utilities for import parsers
 * Provides consistent input validation across all import sources
 */

// Maximum file size for imports (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Valid year range for dates
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

/**
 * Validate a year is within acceptable range
 */
export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/**
 * Validate a month is between 1-12
 */
export function isValidMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

/**
 * Validate a day is between 1-31
 * Optionally accepts month and year for context-aware validation
 */
export function isValidDay(day: number, month?: number, year?: number): boolean {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return false;
  }

  // If month provided, do context-aware validation
  if (month !== undefined && isValidMonth(month)) {
    const daysInMonth = getDaysInMonth(month, year);
    return day <= daysInMonth;
  }

  return true;
}

/**
 * Get the number of days in a month
 */
export function getDaysInMonth(month: number, year?: number): number {
  // February
  if (month === 2) {
    if (year !== undefined && isLeapYear(year)) {
      return 29;
    }
    return 28;
  }

  // 30-day months: April, June, September, November
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }

  // 31-day months
  return 31;
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Validate date components and return a Date object or null
 */
export function createValidDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date | null {
  if (!isValidYear(year) || !isValidMonth(month) || !isValidDay(day, month, year)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);

  // Verify the date didn't overflow (e.g., Feb 30 -> Mar 2)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Validate a Date object
 */
export function isValidDate(date: Date | null | undefined): date is Date {
  if (!date || !(date instanceof Date)) {
    return false;
  }

  const time = date.getTime();
  if (isNaN(time)) {
    return false;
  }

  const year = date.getFullYear();
  return isValidYear(year);
}

/**
 * Validate file size is within limits
 */
export function isValidFileSize(size: number, maxSize = MAX_FILE_SIZE): boolean {
  return size >= 0 && size <= maxSize;
}

/**
 * Check file size and throw descriptive error if too large
 */
export function validateFileSize(file: File, maxSize = MAX_FILE_SIZE): void {
  if (!isValidFileSize(file.size, maxSize)) {
    const sizeMB = Math.round(file.size / (1024 * 1024));
    const maxMB = Math.round(maxSize / (1024 * 1024));
    throw new Error(`File "${file.name}" is too large (${sizeMB}MB). Maximum allowed size is ${maxMB}MB.`);
  }
}

/**
 * Sanitize a string for safe storage/display
 * Removes control characters but preserves newlines and tabs
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // Remove null bytes and other control characters except newlines and tabs
  // \x00-\x08: NULL through BACKSPACE
  // \x0B: Vertical tab
  // \x0C: Form feed
  // \x0E-\x1F: Shift out through Unit separator
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Truncate a string to a maximum length
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) {
    return str || '';
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Validate a timestamp is within reasonable bounds
 * @param timestamp Unix timestamp in seconds or milliseconds
 * @param isMilliseconds Whether the timestamp is in milliseconds
 */
export function isValidTimestamp(timestamp: number, isMilliseconds = false): boolean {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    return false;
  }

  // Convert to milliseconds for comparison
  const ms = isMilliseconds ? timestamp : timestamp * 1000;

  // Min: Jan 1, 1900
  const minMs = new Date(MIN_YEAR, 0, 1).getTime();
  // Max: Dec 31, 2100
  const maxMs = new Date(MAX_YEAR, 11, 31, 23, 59, 59, 999).getTime();

  return ms >= minMs && ms <= maxMs;
}

/**
 * Convert a timestamp to a Date object with validation
 */
export function timestampToDate(timestamp: number, isMilliseconds = false): Date | null {
  if (!isValidTimestamp(timestamp, isMilliseconds)) {
    return null;
  }

  const ms = isMilliseconds ? timestamp : timestamp * 1000;
  const date = new Date(ms);

  return isValidDate(date) ? date : null;
}

/**
 * Validate GPS coordinates
 */
export function isValidGpsCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Check if GPS coordinates are likely valid (not 0,0 which is often a default)
 */
export function hasValidGpsCoordinate(latitude: number, longitude: number): boolean {
  if (!isValidGpsCoordinate(latitude, longitude)) {
    return false;
  }

  // 0,0 is in the ocean and almost never a real location
  // Allow small epsilon for floating point comparison
  const isZero = Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001;
  return !isZero;
}
