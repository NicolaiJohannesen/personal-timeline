import { describe, it, expect } from 'vitest';
import {
  MAX_FILE_SIZE,
  MIN_YEAR,
  MAX_YEAR,
  isValidYear,
  isValidMonth,
  isValidDay,
  getDaysInMonth,
  isLeapYear,
  createValidDate,
  isValidDate,
  isValidFileSize,
  validateFileSize,
  sanitizeString,
  truncateString,
  isValidTimestamp,
  timestampToDate,
  isValidGpsCoordinate,
  hasValidGpsCoordinate,
} from '@/lib/import/validation';

describe('Validation Utilities', () => {
  describe('isValidYear', () => {
    it('returns true for valid years', () => {
      expect(isValidYear(1900)).toBe(true);
      expect(isValidYear(2000)).toBe(true);
      expect(isValidYear(2024)).toBe(true);
      expect(isValidYear(2100)).toBe(true);
    });

    it('returns false for years out of range', () => {
      expect(isValidYear(1899)).toBe(false);
      expect(isValidYear(2101)).toBe(false);
      expect(isValidYear(0)).toBe(false);
      expect(isValidYear(-1)).toBe(false);
    });

    it('returns false for non-integer years', () => {
      expect(isValidYear(2024.5)).toBe(false);
      expect(isValidYear(NaN)).toBe(false);
      expect(isValidYear(Infinity)).toBe(false);
    });
  });

  describe('isValidMonth', () => {
    it('returns true for valid months', () => {
      for (let i = 1; i <= 12; i++) {
        expect(isValidMonth(i)).toBe(true);
      }
    });

    it('returns false for invalid months', () => {
      expect(isValidMonth(0)).toBe(false);
      expect(isValidMonth(13)).toBe(false);
      expect(isValidMonth(-1)).toBe(false);
      expect(isValidMonth(1.5)).toBe(false);
    });
  });

  describe('isValidDay', () => {
    it('returns true for valid days without context', () => {
      expect(isValidDay(1)).toBe(true);
      expect(isValidDay(15)).toBe(true);
      expect(isValidDay(31)).toBe(true);
    });

    it('returns false for invalid days without context', () => {
      expect(isValidDay(0)).toBe(false);
      expect(isValidDay(32)).toBe(false);
      expect(isValidDay(-1)).toBe(false);
      expect(isValidDay(15.5)).toBe(false);
    });

    it('validates days with month context', () => {
      // January has 31 days
      expect(isValidDay(31, 1)).toBe(true);
      // February has 28 days (non-leap year)
      expect(isValidDay(28, 2)).toBe(true);
      expect(isValidDay(29, 2)).toBe(false);
      // April has 30 days
      expect(isValidDay(30, 4)).toBe(true);
      expect(isValidDay(31, 4)).toBe(false);
    });

    it('validates days with month and year context', () => {
      // February in leap year
      expect(isValidDay(29, 2, 2024)).toBe(true);
      expect(isValidDay(29, 2, 2023)).toBe(false);
    });
  });

  describe('getDaysInMonth', () => {
    it('returns correct days for each month', () => {
      expect(getDaysInMonth(1)).toBe(31);
      expect(getDaysInMonth(2)).toBe(28);
      expect(getDaysInMonth(3)).toBe(31);
      expect(getDaysInMonth(4)).toBe(30);
      expect(getDaysInMonth(5)).toBe(31);
      expect(getDaysInMonth(6)).toBe(30);
      expect(getDaysInMonth(7)).toBe(31);
      expect(getDaysInMonth(8)).toBe(31);
      expect(getDaysInMonth(9)).toBe(30);
      expect(getDaysInMonth(10)).toBe(31);
      expect(getDaysInMonth(11)).toBe(30);
      expect(getDaysInMonth(12)).toBe(31);
    });

    it('returns 29 for February in leap years', () => {
      expect(getDaysInMonth(2, 2024)).toBe(29);
      expect(getDaysInMonth(2, 2000)).toBe(29);
    });

    it('returns 28 for February in non-leap years', () => {
      expect(getDaysInMonth(2, 2023)).toBe(28);
      expect(getDaysInMonth(2, 1900)).toBe(28); // Century not divisible by 400
    });
  });

  describe('isLeapYear', () => {
    it('returns true for leap years', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
    });

    it('returns false for non-leap years', () => {
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(1900)).toBe(false); // Century not divisible by 400
      expect(isLeapYear(2100)).toBe(false);
    });
  });

  describe('createValidDate', () => {
    it('creates valid dates', () => {
      const date = createValidDate(2024, 6, 15);
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(5); // 0-indexed
      expect(date?.getDate()).toBe(15);
    });

    it('creates valid dates with time', () => {
      const date = createValidDate(2024, 6, 15, 14, 30, 45);
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(14);
      expect(date?.getMinutes()).toBe(30);
      expect(date?.getSeconds()).toBe(45);
    });

    it('returns null for invalid year', () => {
      expect(createValidDate(1899, 6, 15)).toBeNull();
      expect(createValidDate(2101, 6, 15)).toBeNull();
    });

    it('returns null for invalid month', () => {
      expect(createValidDate(2024, 0, 15)).toBeNull();
      expect(createValidDate(2024, 13, 15)).toBeNull();
    });

    it('returns null for invalid day', () => {
      expect(createValidDate(2024, 6, 0)).toBeNull();
      expect(createValidDate(2024, 6, 32)).toBeNull();
      expect(createValidDate(2024, 2, 30)).toBeNull(); // Feb 30 invalid
    });

    it('returns null for invalid time components', () => {
      expect(createValidDate(2024, 6, 15, -1)).toBeNull();
      expect(createValidDate(2024, 6, 15, 24)).toBeNull();
      expect(createValidDate(2024, 6, 15, 12, -1)).toBeNull();
      expect(createValidDate(2024, 6, 15, 12, 60)).toBeNull();
      expect(createValidDate(2024, 6, 15, 12, 30, -1)).toBeNull();
      expect(createValidDate(2024, 6, 15, 12, 30, 60)).toBeNull();
    });

    it('handles leap year February correctly', () => {
      expect(createValidDate(2024, 2, 29)).not.toBeNull();
      expect(createValidDate(2023, 2, 29)).toBeNull();
    });
  });

  describe('isValidDate', () => {
    it('returns true for valid dates', () => {
      expect(isValidDate(new Date(2024, 5, 15))).toBe(true);
      expect(isValidDate(new Date('2024-06-15'))).toBe(true);
    });

    it('returns false for invalid dates', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });

    it('returns false for dates outside valid year range', () => {
      expect(isValidDate(new Date(1899, 0, 1))).toBe(false);
      expect(isValidDate(new Date(2101, 0, 1))).toBe(false);
    });
  });

  describe('isValidFileSize', () => {
    it('returns true for valid file sizes', () => {
      expect(isValidFileSize(0)).toBe(true);
      expect(isValidFileSize(1024)).toBe(true);
      expect(isValidFileSize(MAX_FILE_SIZE)).toBe(true);
    });

    it('returns false for oversized files', () => {
      expect(isValidFileSize(MAX_FILE_SIZE + 1)).toBe(false);
    });

    it('returns false for negative sizes', () => {
      expect(isValidFileSize(-1)).toBe(false);
    });

    it('respects custom max size', () => {
      expect(isValidFileSize(1000, 500)).toBe(false);
      expect(isValidFileSize(500, 1000)).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('does not throw for valid file sizes', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect(() => validateFileSize(file)).not.toThrow();
    });

    it('throws descriptive error for oversized files', () => {
      // Create a mock file with large size
      const file = new File(['test'], 'large.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1 });

      expect(() => validateFileSize(file)).toThrow(/too large/);
      expect(() => validateFileSize(file)).toThrow(/large.txt/);
    });
  });

  describe('sanitizeString', () => {
    it('returns empty string for invalid input', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null as unknown as string)).toBe('');
      expect(sanitizeString(undefined as unknown as string)).toBe('');
    });

    it('preserves normal text', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
      expect(sanitizeString('Line 1\nLine 2')).toBe('Line 1\nLine 2');
      expect(sanitizeString('Tab\there')).toBe('Tab\there');
    });

    it('removes control characters', () => {
      expect(sanitizeString('Hello\x00World')).toBe('HelloWorld');
      expect(sanitizeString('Test\x01\x02\x03')).toBe('Test');
      expect(sanitizeString('\x0BVertical\x0CTab')).toBe('VerticalTab');
    });

    it('preserves newlines and carriage returns', () => {
      expect(sanitizeString('Line 1\nLine 2\rLine 3')).toBe('Line 1\nLine 2\rLine 3');
    });

    it('handles unicode correctly', () => {
      expect(sanitizeString('日本語')).toBe('日本語');
      expect(sanitizeString('émojis 🎉')).toBe('émojis 🎉');
    });
  });

  describe('truncateString', () => {
    it('returns original string if shorter than max', () => {
      expect(truncateString('short', 10)).toBe('short');
    });

    it('truncates long strings with ellipsis', () => {
      expect(truncateString('This is a long string', 10)).toBe('This is...');
    });

    it('handles empty string', () => {
      expect(truncateString('', 10)).toBe('');
    });

    it('handles exact length', () => {
      expect(truncateString('exactly', 7)).toBe('exactly');
    });
  });

  describe('isValidTimestamp', () => {
    it('returns true for valid timestamps in seconds', () => {
      expect(isValidTimestamp(0, false)).toBe(true); // 1970-01-01 (Unix epoch) - within 1900-2100
      expect(isValidTimestamp(946684800)).toBe(true); // 2000-01-01
      expect(isValidTimestamp(1704067200)).toBe(true); // 2024-01-01
    });

    it('returns true for valid timestamps in milliseconds', () => {
      expect(isValidTimestamp(946684800000, true)).toBe(true); // 2000-01-01
      expect(isValidTimestamp(1704067200000, true)).toBe(true); // 2024-01-01
    });

    it('returns false for invalid timestamps', () => {
      expect(isValidTimestamp(-1)).toBe(false);
      expect(isValidTimestamp(NaN)).toBe(false);
      expect(isValidTimestamp(Infinity)).toBe(false);
    });

    it('returns false for timestamps outside valid range', () => {
      // Before 1900
      expect(isValidTimestamp(-2208988800)).toBe(false);
      // After 2100
      expect(isValidTimestamp(4133980800)).toBe(false);
    });
  });

  describe('timestampToDate', () => {
    it('converts valid timestamps to dates', () => {
      const date = timestampToDate(1704067200); // 2024-01-01 00:00:00 UTC
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2024);
    });

    it('handles millisecond timestamps', () => {
      const date = timestampToDate(1704067200000, true);
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2024);
    });

    it('returns null for invalid timestamps', () => {
      expect(timestampToDate(-1)).toBeNull();
      expect(timestampToDate(NaN)).toBeNull();
    });
  });

  describe('isValidGpsCoordinate', () => {
    it('returns true for valid coordinates', () => {
      expect(isValidGpsCoordinate(0, 0)).toBe(true);
      expect(isValidGpsCoordinate(90, 180)).toBe(true);
      expect(isValidGpsCoordinate(-90, -180)).toBe(true);
      expect(isValidGpsCoordinate(37.7749, -122.4194)).toBe(true); // San Francisco
    });

    it('returns false for out of range coordinates', () => {
      expect(isValidGpsCoordinate(91, 0)).toBe(false);
      expect(isValidGpsCoordinate(-91, 0)).toBe(false);
      expect(isValidGpsCoordinate(0, 181)).toBe(false);
      expect(isValidGpsCoordinate(0, -181)).toBe(false);
    });

    it('returns false for non-finite values', () => {
      expect(isValidGpsCoordinate(NaN, 0)).toBe(false);
      expect(isValidGpsCoordinate(0, NaN)).toBe(false);
      expect(isValidGpsCoordinate(Infinity, 0)).toBe(false);
    });
  });

  describe('hasValidGpsCoordinate', () => {
    it('returns true for non-zero valid coordinates', () => {
      expect(hasValidGpsCoordinate(37.7749, -122.4194)).toBe(true);
      expect(hasValidGpsCoordinate(-33.8688, 151.2093)).toBe(true); // Sydney
    });

    it('returns false for 0,0 (null island)', () => {
      expect(hasValidGpsCoordinate(0, 0)).toBe(false);
      expect(hasValidGpsCoordinate(0.00001, 0.00001)).toBe(false);
    });

    it('returns false for invalid coordinates', () => {
      expect(hasValidGpsCoordinate(91, 0)).toBe(false);
      expect(hasValidGpsCoordinate(NaN, 0)).toBe(false);
    });
  });

  describe('constants', () => {
    it('has correct MAX_FILE_SIZE', () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024); // 50MB
    });

    it('has correct year range', () => {
      expect(MIN_YEAR).toBe(1900);
      expect(MAX_YEAR).toBe(2100);
    });
  });
});
