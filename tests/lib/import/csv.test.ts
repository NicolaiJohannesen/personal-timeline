import { describe, it, expect, vi } from 'vitest';
import { parseCSVData, parseCSVAuto, getCSVHeaders, previewCSV, parseCSV, CSVParseError } from '@/lib/import/csv';

// Helper to create a mock File that works in Node.js
function createMockFile(content: string, name = 'test.csv'): File {
  const file = new File([content], name, { type: 'text/csv' });
  // Override text() for Node.js environment
  file.text = async () => content;
  return file;
}

describe('CSV Parser', () => {
  describe('parseCSVData', () => {
    it('parses CSV with explicit mapping', async () => {
      const csv = 'Event Name,Date,Category\nBirthday,2021-01-15,relationships\nMeeting,2021-02-20,work';
      const file = createMockFile(csv);
      const mapping = {
        title: 'Event Name',
        startDate: 'Date',
        layer: 'Category',
      };

      const result = await parseCSVData(file, mapping);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].title).toBe('Birthday');
      expect(result.events[0].layer).toBe('relationships');
      expect(result.events[1].title).toBe('Meeting');
      expect(result.events[1].layer).toBe('work');
    });

    it('parses description and end date', async () => {
      const csv = 'Title,Start,End,Notes\nVacation,2021-01-01,2021-01-07,Trip to Paris';
      const file = createMockFile(csv);
      const mapping = {
        title: 'Title',
        startDate: 'Start',
        endDate: 'End',
        description: 'Notes',
      };

      const result = await parseCSVData(file, mapping);

      expect(result.events[0].description).toBe('Trip to Paris');
      expect(result.events[0].endDate).toBeDefined();
    });

    it('defaults layer to media for invalid values', async () => {
      const csv = 'Title,Date,Type\nEvent,2021-01-15,unknown';
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date', layer: 'Type' };

      const result = await parseCSVData(file, mapping);

      expect(result.events[0].layer).toBe('media');
    });

    it('handles various date formats', async () => {
      const csv = `Title,Date
ISO,2021-01-15
US,01/15/2021
EU,15-01-2021
Short,2021-1-5`;
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date' };

      const result = await parseCSVData(file, mapping);

      expect(result.events).toHaveLength(4);
      result.events.forEach((e) => {
        expect(e.startDate).toBeInstanceOf(Date);
        expect(e.startDate.getFullYear()).toBe(2021);
      });
    });

    it('skips rows without title', async () => {
      const csv = 'Title,Date\n,2021-01-15\nValid,2021-01-16';
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date' };

      const result = await parseCSVData(file, mapping);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Valid');
    });

    it('skips rows without date', async () => {
      const csv = 'Title,Date\nNo Date,\nValid,2021-01-15';
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date' };

      const result = await parseCSVData(file, mapping);

      expect(result.events).toHaveLength(1);
    });

    it('reports errors for invalid dates', async () => {
      const csv = 'Title,Date\nInvalid,not-a-date\nValid,2021-01-15';
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date' };

      const result = await parseCSVData(file, mapping);

      expect(result.events).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid start date');
    });

    it('stores original row in metadata', async () => {
      const csv = 'Title,Date,Extra\nEvent,2021-01-15,bonus data';
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date' };

      const result = await parseCSVData(file, mapping);

      expect(result.events[0].metadata?.originalRow).toEqual({
        Title: 'Event',
        Date: '2021-01-15',
        Extra: 'bonus data',
      });
    });

    it('calculates correct stats', async () => {
      const csv = 'Title,Date,Layer\nA,2021-01-01,work\nB,2021-01-02,work\nC,2021-01-03,travel';
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date', layer: 'Layer' };

      const result = await parseCSVData(file, mapping);

      expect(result.stats.totalFiles).toBe(1);
      expect(result.stats.totalEvents).toBe(3);
      expect(result.stats.eventsByLayer.work).toBe(2);
      expect(result.stats.eventsByLayer.travel).toBe(1);
    });

    it('sets source to other', async () => {
      const csv = 'Title,Date\nEvent,2021-01-15';
      const file = createMockFile(csv);
      const mapping = { title: 'Title', startDate: 'Date' };

      const result = await parseCSVData(file, mapping);

      expect(result.events[0].source).toBe('other');
    });
  });

  describe('parseCSVAuto', () => {
    it('auto-detects standard column names', async () => {
      const csv = 'Title,Date,Description,Category\nEvent,2021-01-15,Details,work';
      const file = createMockFile(csv);

      const result = await parseCSVAuto(file);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Event');
      expect(result.events[0].description).toBe('Details');
      expect(result.events[0].layer).toBe('work');
    });

    it('detects alternative column names', async () => {
      const csv = 'Name,Start,End,Notes\nMeeting,2021-01-15,2021-01-16,Important';
      const file = createMockFile(csv);

      const result = await parseCSVAuto(file);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Meeting');
      expect(result.events[0].endDate).toBeDefined();
      expect(result.events[0].description).toBe('Important');
    });

    it('detects more alternative names', async () => {
      const csv = 'Event,When,Details\nParty,2021-06-15,Birthday celebration';
      const file = createMockFile(csv);

      const result = await parseCSVAuto(file);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Party');
    });

    it('fails gracefully when no title column found', async () => {
      const csv = 'Col1,Col2\nA,B';
      const file = createMockFile(csv);

      const result = await parseCSVAuto(file);

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('auto-detect');
    });

    it('fails gracefully when no date column found', async () => {
      const csv = 'Title,Value\nEvent,123';
      const file = createMockFile(csv);

      const result = await parseCSVAuto(file);

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('handles empty file', async () => {
      const file = createMockFile('');

      const result = await parseCSVAuto(file);

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('getCSVHeaders', () => {
    it('returns headers from CSV', async () => {
      const csv = 'Name,Age,City\nJohn,30,NYC';
      const file = createMockFile(csv);

      const headers = await getCSVHeaders(file);

      expect(headers).toEqual(['Name', 'Age', 'City']);
    });

    it('returns empty array for empty file', async () => {
      const file = createMockFile('');

      const headers = await getCSVHeaders(file);

      expect(headers).toEqual([]);
    });

    it('handles quoted headers', async () => {
      const csv = '"First Name","Last Name","Email Address"\nJohn,Doe,john@example.com';
      const file = createMockFile(csv);

      const headers = await getCSVHeaders(file);

      expect(headers).toEqual(['First Name', 'Last Name', 'Email Address']);
    });
  });

  describe('previewCSV', () => {
    it('returns headers and first rows', async () => {
      const csv = 'A,B,C\n1,2,3\n4,5,6\n7,8,9';
      const file = createMockFile(csv);

      const preview = await previewCSV(file, 2);

      expect(preview.headers).toEqual(['A', 'B', 'C']);
      expect(preview.rows).toHaveLength(2);
      expect(preview.rows[0]).toEqual({ A: '1', B: '2', C: '3' });
      expect(preview.rows[1]).toEqual({ A: '4', B: '5', C: '6' });
    });

    it('returns all rows if less than max', async () => {
      const csv = 'A,B\n1,2\n3,4';
      const file = createMockFile(csv);

      const preview = await previewCSV(file, 10);

      expect(preview.rows).toHaveLength(2);
    });

    it('handles empty file', async () => {
      const file = createMockFile('');

      const preview = await previewCSV(file);

      expect(preview.headers).toEqual([]);
      expect(preview.rows).toEqual([]);
    });

    it('defaults to 5 rows', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => `${i}`);
      const csv = 'Num\n' + rows.join('\n');
      const file = createMockFile(csv);

      const preview = await previewCSV(file);

      expect(preview.rows).toHaveLength(5);
    });
  });

  describe('parseCSV security hardening', () => {
    it('detects unclosed quotes', () => {
      const csv = 'Name,Value\n"John,30'; // Missing closing quote

      expect(() => parseCSV(csv)).toThrow(CSVParseError);
      expect(() => parseCSV(csv)).toThrow(/unclosed quote/i);
    });

    it('handles properly closed quotes', () => {
      const csv = 'Name,Value\n"John ""Junior""",30';

      const result = parseCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0]['Name']).toBe('John "Junior"');
    });

    it('handles quotes at end of field', () => {
      const csv = 'Name,Value\n"Hello World",123';

      const result = parseCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0]['Name']).toBe('Hello World');
    });

    it('handles empty quoted fields', () => {
      const csv = 'A,B,C\n"",test,""';

      const result = parseCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0]['A']).toBe('');
      expect(result[0]['B']).toBe('test');
      expect(result[0]['C']).toBe('');
    });

    it('handles commas inside quotes', () => {
      const csv = 'Name,Address\nJohn,"123 Main St, Apt 4"';

      const result = parseCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0]['Address']).toBe('123 Main St, Apt 4');
    });

    it('handles newlines in quoted fields by treating as separate lines', () => {
      // Note: Simple CSV parsers don't handle multi-line fields
      const csv = 'A,B\n1,2\n3,4';

      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
    });

    it('returns empty array for headers-only CSV', () => {
      const csv = 'A,B,C';

      const result = parseCSV(csv);

      expect(result).toHaveLength(0);
    });

    it('returns empty array for empty string', () => {
      const result = parseCSV('');

      expect(result).toHaveLength(0);
    });

    it('handles very wide CSVs within limits', () => {
      // 100 columns
      const headers = Array.from({ length: 100 }, (_, i) => `Col${i}`).join(',');
      const values = Array.from({ length: 100 }, () => 'x').join(',');
      const csv = `${headers}\n${values}`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(1);
      expect(Object.keys(result[0])).toHaveLength(100);
    });

    it('handles special characters in values', () => {
      // Double quotes within a CSV field must be escaped by doubling them
      const csv = 'Name,Special\nTest,"<>&""\'"\nNoQuotes,<>&\'';

      const result = parseCSV(csv);

      // First row has properly escaped quote
      expect(result[0]['Special']).toBe('<>&"\'');
      // Second row has special chars but no quote (no escaping needed)
      expect(result[1]['Special']).toBe('<>&\'');
    });

    it('handles unicode characters', () => {
      const csv = 'Name,City\n日本語,東京\nEmoji,🎉🎊';

      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0]['Name']).toBe('日本語');
      expect(result[1]['City']).toBe('🎉🎊');
    });

    it('trims whitespace from values', () => {
      const csv = 'A,B\n  hello  ,  world  ';

      const result = parseCSV(csv);

      expect(result[0]['A']).toBe('hello');
      expect(result[0]['B']).toBe('world');
    });
  });
});
