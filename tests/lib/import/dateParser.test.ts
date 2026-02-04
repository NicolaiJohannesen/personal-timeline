import { describe, it, expect } from 'vitest';
import {
  parseDate,
  parseISODate,
  parseSlashDate,
  parseDashDotDate,
  parseMonthYearDate,
  parseYearOnly,
  parseTimestamp,
  extractDateFromPath,
  parseExifDate,
  parseICalDate,
  getBestDate,
} from '@/lib/import/dateParser';

describe('Date Parser', () => {
  describe('parseDate', () => {
    it('returns null for invalid input', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate('   ')).toBeNull();
      expect(parseDate('not a date')).toBeNull();
    });

    it('parses ISO format dates', () => {
      const date = parseDate('2024-06-15');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(5); // June (0-indexed)
      expect(date?.getDate()).toBe(15);
    });

    it('parses US format dates (MM/DD/YYYY)', () => {
      const date = parseDate('06/15/2024');
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(5); // June
      expect(date?.getDate()).toBe(15);
    });

    it('parses EU format dates when specified', () => {
      const date = parseDate('15/06/2024', { preferUSFormat: false });
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(5); // June
      expect(date?.getDate()).toBe(15);
    });

    it('parses dash-separated dates', () => {
      const date = parseDate('15-06-2024');
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(5);
    });

    it('parses month-year format', () => {
      const date = parseDate('Jun 2024');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(5);
      expect(date?.getDate()).toBe(1);
    });

    it('parses year-only format', () => {
      const date = parseDate('2024');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(0);
      expect(date?.getDate()).toBe(1);
    });
  });

  describe('parseISODate', () => {
    it('parses standard ISO format', () => {
      const date = parseISODate('2024-06-15');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
    });

    it('parses ISO with time', () => {
      const date = parseISODate('2024-06-15T14:30:00');
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(14);
      expect(date?.getMinutes()).toBe(30);
    });

    it('parses ISO with timezone', () => {
      const date = parseISODate('2024-06-15T14:30:00Z');
      expect(date).not.toBeNull();
      expect(date?.getUTCHours()).toBe(14);
    });

    it('returns null for invalid dates', () => {
      expect(parseISODate('invalid')).toBeNull();
      expect(parseISODate('')).toBeNull();
    });

    it('returns null for dates outside valid year range', () => {
      expect(parseISODate('1899-01-01')).toBeNull();
      expect(parseISODate('2101-01-01')).toBeNull();
    });
  });

  describe('parseSlashDate', () => {
    it('parses US format (MM/DD/YYYY)', () => {
      const date = parseSlashDate('06/15/2024', true);
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(5);
      expect(date?.getDate()).toBe(15);
    });

    it('parses EU format (DD/MM/YYYY)', () => {
      const date = parseSlashDate('15/06/2024', false);
      expect(date).not.toBeNull();
      expect(date?.getDate()).toBe(15);
      expect(date?.getMonth()).toBe(5);
    });

    it('returns null for invalid formats', () => {
      expect(parseSlashDate('2024-06-15', true)).toBeNull();
      expect(parseSlashDate('06-15-2024', true)).toBeNull();
    });

    it('handles single digit month/day', () => {
      const date = parseSlashDate('6/5/2024', true);
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(5);
      expect(date?.getDate()).toBe(5);
    });

    it('validates date components', () => {
      expect(parseSlashDate('13/32/2024', true)).toBeNull(); // Invalid month/day
      expect(parseSlashDate('02/30/2024', true)).toBeNull(); // Feb 30 invalid
    });
  });

  describe('parseDashDotDate', () => {
    it('parses YYYY-MM-DD format', () => {
      const date = parseDashDotDate('2024-06-15');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
    });

    it('parses DD-MM-YYYY format', () => {
      const date = parseDashDotDate('15-06-2024');
      expect(date).not.toBeNull();
      expect(date?.getDate()).toBe(15);
      expect(date?.getMonth()).toBe(5);
    });

    it('parses dot-separated format', () => {
      const date = parseDashDotDate('15.06.2024');
      expect(date).not.toBeNull();
      expect(date?.getDate()).toBe(15);
    });

    it('parses YYYY.MM.DD format', () => {
      const date = parseDashDotDate('2024.06.15');
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(5);
    });

    it('returns null for invalid formats', () => {
      expect(parseDashDotDate('06/15/2024')).toBeNull();
      expect(parseDashDotDate('invalid')).toBeNull();
    });
  });

  describe('parseMonthYearDate', () => {
    it('parses short month names', () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach((month, idx) => {
        const date = parseMonthYearDate(`${month} 2024`);
        expect(date).not.toBeNull();
        expect(date?.getMonth()).toBe(idx);
      });
    });

    it('parses full month names', () => {
      const date = parseMonthYearDate('January 2024');
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(0);
    });

    it('is case insensitive', () => {
      expect(parseMonthYearDate('JAN 2024')?.getMonth()).toBe(0);
      expect(parseMonthYearDate('jan 2024')?.getMonth()).toBe(0);
    });

    it('returns first day of month', () => {
      const date = parseMonthYearDate('Jun 2024');
      expect(date?.getDate()).toBe(1);
    });

    it('returns null for invalid month names', () => {
      expect(parseMonthYearDate('Xyz 2024')).toBeNull();
      expect(parseMonthYearDate('2024 Jun')).toBeNull();
    });
  });

  describe('parseYearOnly', () => {
    it('parses 4-digit years', () => {
      const date = parseYearOnly('2024');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(0);
      expect(date?.getDate()).toBe(1);
    });

    it('returns null for years out of range', () => {
      expect(parseYearOnly('1899')).toBeNull();
      expect(parseYearOnly('2101')).toBeNull();
    });

    it('returns null for non-year formats', () => {
      expect(parseYearOnly('24')).toBeNull();
      expect(parseYearOnly('20240')).toBeNull();
      expect(parseYearOnly('abcd')).toBeNull();
    });
  });

  describe('parseTimestamp', () => {
    it('parses Unix timestamps in seconds', () => {
      const date = parseTimestamp(1704067200); // 2024-01-01 00:00:00 UTC
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2024);
    });

    it('parses Unix timestamps in milliseconds', () => {
      const date = parseTimestamp(1704067200000);
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2024);
    });

    it('parses string timestamps', () => {
      const date = parseTimestamp('1704067200000');
      expect(date).not.toBeNull();
    });

    it('returns null for invalid timestamps', () => {
      expect(parseTimestamp(-1)).toBeNull();
      expect(parseTimestamp(NaN)).toBeNull();
      expect(parseTimestamp('invalid')).toBeNull();
    });
  });

  describe('extractDateFromPath', () => {
    it('extracts ISO-style dates from paths', () => {
      const date = extractDateFromPath('photos/2024-06-15/image.jpg');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(5);
    });

    it('extracts dates with underscores', () => {
      const date = extractDateFromPath('photos_2024_06_15_image.jpg');
      expect(date).not.toBeNull();
    });

    it('extracts dates with time', () => {
      const date = extractDateFromPath('photos/2024-06-15_14-30-00_UTC.jpg');
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(14);
    });

    it('extracts year-month from paths', () => {
      const date = extractDateFromPath('photos/2024-06/image.jpg');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(5);
    });

    it('extracts year from folder paths', () => {
      const date = extractDateFromPath('photos/2024/vacation/image.jpg');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
    });

    it('extracts millisecond timestamps', () => {
      const date = extractDateFromPath('photo_1704067200000.jpg');
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2024);
    });

    it('extracts second timestamps', () => {
      const date = extractDateFromPath('video_1704067200.mp4');
      expect(date).not.toBeNull();
    });

    it('returns null for paths without dates', () => {
      expect(extractDateFromPath('photos/vacation/image.jpg')).toBeNull();
      expect(extractDateFromPath('')).toBeNull();
    });
  });

  describe('parseExifDate', () => {
    it('parses EXIF date format', () => {
      const date = parseExifDate('2024:06:15 14:30:45');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(5);
      expect(date?.getDate()).toBe(15);
      expect(date?.getHours()).toBe(14);
      expect(date?.getMinutes()).toBe(30);
      expect(date?.getSeconds()).toBe(45);
    });

    it('returns null for short strings', () => {
      expect(parseExifDate('')).toBeNull();
      expect(parseExifDate('2024:06:15')).toBeNull(); // Too short
    });

    it('returns null for invalid format', () => {
      expect(parseExifDate('2024-06-15 14:30:45')).toBeNull(); // Wrong separator
      expect(parseExifDate('not a date string!')).toBeNull();
    });

    it('validates date components', () => {
      expect(parseExifDate('2024:13:15 14:30:45')).toBeNull(); // Invalid month
      expect(parseExifDate('2024:06:32 14:30:45')).toBeNull(); // Invalid day
    });
  });

  describe('parseICalDate', () => {
    it('parses DATE format (YYYYMMDD)', () => {
      const date = parseICalDate('20240615');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(5);
      expect(date?.getDate()).toBe(15);
    });

    it('parses DATE-TIME format', () => {
      const date = parseICalDate('20240615T143045');
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(14);
      expect(date?.getMinutes()).toBe(30);
      expect(date?.getSeconds()).toBe(45);
    });

    it('parses UTC DATE-TIME format', () => {
      const date = parseICalDate('20240615T143045Z');
      expect(date).not.toBeNull();
      expect(date?.getUTCHours()).toBe(14);
    });

    it('handles all-day flag', () => {
      const date = parseICalDate('20240615T143045', true);
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(0); // All-day ignores time
    });

    it('returns null for invalid formats', () => {
      expect(parseICalDate('')).toBeNull();
      expect(parseICalDate('2024061')).toBeNull(); // Too short
      expect(parseICalDate('invalid!')).toBeNull();
    });

    it('validates date components', () => {
      expect(parseICalDate('20241315')).toBeNull(); // Invalid month
    });
  });

  describe('getBestDate', () => {
    it('returns first valid date', () => {
      const date1 = new Date('2024-06-15');
      const date2 = new Date('2024-06-16');
      expect(getBestDate(date1, date2)).toBe(date1);
    });

    it('skips null/undefined values', () => {
      const date = new Date('2024-06-15');
      expect(getBestDate(null, undefined, date)).toBe(date);
    });

    it('skips invalid dates', () => {
      const invalidDate = new Date('invalid');
      const validDate = new Date('2024-06-15');
      expect(getBestDate(invalidDate, validDate)).toBe(validDate);
    });

    it('returns null if no valid dates', () => {
      expect(getBestDate(null, undefined, new Date('invalid'))).toBeNull();
    });

    it('skips dates outside valid year range', () => {
      const oldDate = new Date('1800-01-01');
      const validDate = new Date('2024-06-15');
      expect(getBestDate(oldDate, validDate)).toBe(validDate);
    });
  });

  describe('edge cases', () => {
    it('handles February 29 in leap years', () => {
      expect(parseDate('02/29/2024')).not.toBeNull(); // 2024 is leap year
      expect(parseDate('02/29/2023')).toBeNull(); // 2023 is not
    });

    it('handles boundary years', () => {
      expect(parseDate('01/01/1900')).not.toBeNull();
      expect(parseDate('12/31/2100')).not.toBeNull();
    });

    it('handles dates at epoch', () => {
      const date = parseTimestamp(0);
      // 0 is 1970-01-01, which is within valid range
      expect(date).not.toBeNull();
    });
  });
});
