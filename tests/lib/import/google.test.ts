import { describe, it, expect } from 'vitest';
import { parseGoogleObject, parseGoogleData } from '@/lib/import/google';

// Helper to create mock files
function createMockFile(content: string, name: string, type = 'application/json'): File {
  const file = new File([content], name, { type });
  // Override text() method for Node.js environment
  (file as any).text = async () => content;
  return file;
}

describe('Google Parser', () => {
  describe('parseGoogleObject', () => {
    describe('Location History', () => {
      it('parses location data', () => {
        const data = {
          locations: [
            {
              timestampMs: '1609459200000', // 2021-01-01
              latitudeE7: 407749950, // ~40.7749
              longitudeE7: -740059730, // ~-74.0059
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].layer).toBe('travel');
        expect(result.events[0].eventType).toBe('location');
        expect(result.events[0].source).toBe('google');
        expect(result.events[0].location?.latitude).toBeCloseTo(40.7749, 2);
        expect(result.events[0].location?.longitude).toBeCloseTo(-74.0059, 2);
      });

      it('groups locations by day', () => {
        const baseTime = 1609459200000; // 2021-01-01 00:00:00
        const data = {
          locations: [
            { timestampMs: String(baseTime), latitudeE7: 100000000, longitudeE7: 100000000 },
            { timestampMs: String(baseTime + 3600000), latitudeE7: 100000000, longitudeE7: 100000000 }, // +1 hour
            { timestampMs: String(baseTime + 86400000), latitudeE7: 100000000, longitudeE7: 100000000 }, // +1 day
          ],
        };

        const result = parseGoogleObject(data);

        // Should create 2 events (2 days)
        expect(result.events).toHaveLength(2);
      });

      it('tracks point count in metadata', () => {
        const baseTime = 1609459200000;
        const data = {
          locations: [
            { timestampMs: String(baseTime), latitudeE7: 100000000, longitudeE7: 100000000 },
            { timestampMs: String(baseTime + 1000), latitudeE7: 100000000, longitudeE7: 100000000 },
            { timestampMs: String(baseTime + 2000), latitudeE7: 100000000, longitudeE7: 100000000 },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events[0].metadata?.pointCount).toBe(3);
      });

      it('skips locations without required fields', () => {
        const data = {
          locations: [
            { latitudeE7: 100000000, longitudeE7: 100000000 }, // no timestamp
            { timestampMs: '1609459200000', longitudeE7: 100000000 }, // no latitude
            { timestampMs: '1609459200000', latitudeE7: 100000000 }, // no longitude
            { timestampMs: '1609459200000', latitudeE7: 100000000, longitudeE7: 100000000 }, // valid
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
      });
    });

    describe('Calendar', () => {
      it('parses calendar events', () => {
        const data = {
          calendar: [
            {
              summary: 'Team Meeting',
              description: 'Weekly sync',
              start: { dateTime: '2021-01-15T10:00:00Z' },
              end: { dateTime: '2021-01-15T11:00:00Z' },
              location: 'Conference Room A',
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Team Meeting');
        expect(result.events[0].description).toBe('Weekly sync');
        expect(result.events[0].source).toBe('google');
        expect(result.events[0].location?.name).toBe('Conference Room A');
      });

      it('categorizes work events', () => {
        const data = {
          calendar: [
            { summary: 'Team Meeting', start: { dateTime: '2021-01-15T10:00:00Z' } },
            { summary: 'Job Interview', start: { dateTime: '2021-01-16T10:00:00Z' } },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events.every((e) => e.layer === 'work')).toBe(true);
      });

      it('categorizes travel events', () => {
        const data = {
          calendar: [
            { summary: 'Flight to NYC', start: { dateTime: '2021-01-15T10:00:00Z' } },
            { summary: 'Hotel Check-in', start: { dateTime: '2021-01-15T15:00:00Z' } },
            { summary: 'Vacation Day 1', start: { dateTime: '2021-01-16T09:00:00Z' } },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events.every((e) => e.layer === 'travel')).toBe(true);
      });

      it('categorizes health events', () => {
        const data = {
          calendar: [
            { summary: 'Doctor Appointment', start: { dateTime: '2021-01-15T10:00:00Z' } },
            { summary: 'Gym Session', start: { dateTime: '2021-01-16T07:00:00Z' } },
            { summary: 'Dentist Visit', start: { dateTime: '2021-01-17T14:00:00Z' } },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events.every((e) => e.layer === 'health')).toBe(true);
      });

      it('categorizes social events', () => {
        const data = {
          calendar: [
            { summary: 'Birthday Party', start: { dateTime: '2021-01-15T18:00:00Z' } },
            { summary: 'Dinner with Friends', start: { dateTime: '2021-01-16T19:00:00Z' } },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events.every((e) => e.layer === 'relationships')).toBe(true);
      });

      it('handles all-day events', () => {
        const data = {
          calendar: [
            {
              summary: 'Conference',
              start: { date: '2021-01-15' },
              end: { date: '2021-01-17' },
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].startDate).toBeInstanceOf(Date);
      });

      it('parses calendar from items wrapper', () => {
        const data = {
          calendar: { items: [{ summary: 'Event', start: { dateTime: '2021-01-15T10:00:00Z' } }] } as any,
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
      });

      it('skips events without summary', () => {
        const data = {
          calendar: [
            { start: { dateTime: '2021-01-15T10:00:00Z' } },
            { summary: 'Valid', start: { dateTime: '2021-01-15T10:00:00Z' } },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
      });

      it('skips events without start date', () => {
        const data = {
          calendar: [
            { summary: 'No Date' },
            { summary: 'Valid', start: { dateTime: '2021-01-15T10:00:00Z' } },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
      });
    });

    describe('Keep Notes', () => {
      it('parses keep notes', () => {
        const data = {
          keep: [
            {
              title: 'Shopping List',
              textContent: 'Milk, Eggs, Bread',
              createdTimestampUsec: 1609459200000000, // microseconds
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Shopping List');
        expect(result.events[0].description).toBe('Milk, Eggs, Bread');
        expect(result.events[0].layer).toBe('media');
        expect(result.events[0].eventType).toBe('note');
      });

      it('uses edited timestamp if available', () => {
        const created = 1609459200000000;
        const edited = 1609545600000000; // 1 day later
        const data = {
          keep: [
            {
              title: 'Note',
              createdTimestampUsec: created,
              userEditedTimestampUsec: edited,
            },
          ],
        };

        const result = parseGoogleObject(data);

        // Should use edited timestamp
        expect(result.events[0].startDate.getTime()).toBe(edited / 1000);
      });

      it('uses content as title if no title', () => {
        const data = {
          keep: [
            {
              textContent: 'This is a long note without a title that should be truncated',
              createdTimestampUsec: 1609459200000000,
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events[0].title.length).toBeLessThanOrEqual(100);
      });

      it('stores labels in metadata', () => {
        const data = {
          keep: [
            {
              title: 'Note',
              createdTimestampUsec: 1609459200000000,
              labels: [{ name: 'Work' }, { name: 'Important' }],
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events[0].metadata?.labels).toEqual(['Work', 'Important']);
      });

      it('skips notes without title and content', () => {
        const data = {
          keep: [
            { createdTimestampUsec: 1609459200000000 },
            { title: 'Valid', createdTimestampUsec: 1609459200000000 },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
      });

      it('skips notes without timestamp', () => {
        const data = {
          keep: [
            { title: 'No Timestamp' },
            { title: 'Valid', createdTimestampUsec: 1609459200000000 },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
      });

      it('parses checklist notes with listContent', () => {
        const data = {
          keep: [
            {
              title: 'Groceries',
              listContent: [
                { text: 'Milk', isChecked: false },
                { text: 'Eggs', isChecked: true },
                { text: 'Bread', isChecked: false },
              ],
              createdTimestampUsec: 1609459200000000,
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Groceries');
        expect(result.events[0].eventType).toBe('checklist');
        expect(result.events[0].description).toContain('☐ Milk');
        expect(result.events[0].description).toContain('☑ Eggs');
        expect(result.events[0].description).toContain('☐ Bread');
      });

      it('uses list content as title when no title provided', () => {
        const data = {
          keep: [
            {
              listContent: [
                { text: 'First item', isChecked: false },
                { text: 'Second item', isChecked: true },
              ],
              createdTimestampUsec: 1609459200000000,
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toContain('First item');
      });

      it('skips trashed notes', () => {
        const data = {
          keep: [
            { title: 'Trashed Note', isTrashed: true, createdTimestampUsec: 1609459200000000 },
            { title: 'Active Note', isTrashed: false, createdTimestampUsec: 1609459200000000 },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Active Note');
      });

      it('stores pinned and archived status in metadata', () => {
        const data = {
          keep: [
            {
              title: 'Pinned Note',
              isPinned: true,
              isArchived: false,
              createdTimestampUsec: 1609459200000000,
            },
            {
              title: 'Archived Note',
              isPinned: false,
              isArchived: true,
              createdTimestampUsec: 1609545600000000,
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(2);
        expect(result.events[0].metadata?.isPinned).toBe(true);
        expect(result.events[0].metadata?.isArchived).toBe(false);
        expect(result.events[1].metadata?.isPinned).toBe(false);
        expect(result.events[1].metadata?.isArchived).toBe(true);
      });

      it('handles real Google Takeout Keep format', () => {
        // Real format from Google Takeout export
        const data = {
          keep: [
            {
              color: 'DEFAULT',
              isTrashed: false,
              isPinned: true,
              isArchived: false,
              listContent: [
                { text: 'curry', isChecked: false },
                { text: 'Bread', isChecked: false },
                { text: 'eggs', isChecked: true },
              ],
              title: 'Groceries',
              userEditedTimestampUsec: 1765969809487000,
              createdTimestampUsec: 1730447732475000,
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Groceries');
        expect(result.events[0].eventType).toBe('checklist');
        expect(result.events[0].metadata?.isPinned).toBe(true);
        // Should use userEditedTimestampUsec
        expect(result.events[0].startDate.getTime()).toBe(1765969809487000 / 1000);
      });

      it('handles real Google Takeout text note format', () => {
        const data = {
          keep: [
            {
              color: 'DEFAULT',
              isTrashed: false,
              isPinned: true,
              isArchived: false,
              textContent: 'This is a text note with important information.',
              title: 'Research Notes',
              userEditedTimestampUsec: 1766275139881000,
              createdTimestampUsec: 1766274887217000,
            },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Research Notes');
        expect(result.events[0].eventType).toBe('note');
        expect(result.events[0].description).toBe('This is a text note with important information.');
      });
    });

    describe('Combined data', () => {
      it('parses all data types together', () => {
        const data = {
          locations: [
            { timestampMs: '1609459200000', latitudeE7: 100000000, longitudeE7: 100000000 },
          ],
          calendar: [
            { summary: 'Meeting', start: { dateTime: '2021-01-15T10:00:00Z' } },
          ],
          keep: [
            { title: 'Note', createdTimestampUsec: 1609459200000000 },
          ],
        };

        const result = parseGoogleObject(data);

        expect(result.events).toHaveLength(3);
      });

      it('handles empty data', () => {
        const result = parseGoogleObject({});

        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('parseGoogleData (file handling)', () => {
    describe('File type handling', () => {
      it('silently skips HTML files', async () => {
        const htmlFile = createMockFile('<html><body>Hello</body></html>', 'export.html', 'text/html');

        const result = await parseGoogleData([htmlFile]);

        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(result.stats.skipped).toBe(1);
      });

      it('silently skips image files', async () => {
        const files = [
          createMockFile('fake-image-data', 'photo.jpg', 'image/jpeg'),
          createMockFile('fake-image-data', 'photo.png', 'image/png'),
          createMockFile('fake-image-data', 'photo.gif', 'image/gif'),
        ];

        const result = await parseGoogleData(files);

        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(result.stats.skipped).toBe(3);
      });

      it('silently skips CSS and JS files', async () => {
        const files = [
          createMockFile('.class { color: red; }', 'styles.css', 'text/css'),
          createMockFile('console.log("hi")', 'script.js', 'application/javascript'),
        ];

        const result = await parseGoogleData(files);

        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(result.stats.skipped).toBe(2);
      });

      it('silently skips PDF files', async () => {
        const pdfFile = createMockFile('%PDF-1.4', 'document.pdf', 'application/pdf');

        const result = await parseGoogleData([pdfFile]);

        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(result.stats.skipped).toBe(1);
      });

      it('silently skips invalid JSON files', async () => {
        const invalidJson = createMockFile('{ not valid json', 'data.json');

        const result = await parseGoogleData([invalidJson]);

        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(result.stats.skipped).toBe(1);
      });

      it('processes valid JSON files', async () => {
        const calendarJson = createMockFile(
          JSON.stringify([{ summary: 'Meeting', start: { dateTime: '2021-01-15T10:00:00Z' } }]),
          'calendar.json'
        );

        const result = await parseGoogleData([calendarJson]);

        expect(result.events).toHaveLength(1);
        expect(result.stats.processedFiles).toBe(1);
      });

      it('skips JSON files that do not match known patterns', async () => {
        const unknownJson = createMockFile(
          JSON.stringify({ randomData: true }),
          'unknown_file.json'
        );

        const result = await parseGoogleData([unknownJson]);

        expect(result.events).toHaveLength(0);
        expect(result.stats.skipped).toBe(1);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Mixed file types', () => {
      it('processes JSON files and skips unsupported formats', async () => {
        const files = [
          createMockFile('<html><body>Index</body></html>', 'index.html', 'text/html'),
          createMockFile(
            JSON.stringify([{ summary: 'Event', start: { dateTime: '2021-01-15T10:00:00Z' } }]),
            'calendar.json'
          ),
          createMockFile('fake-image', 'photo.jpg', 'image/jpeg'),
          createMockFile(
            JSON.stringify([{ title: 'Note', createdTimestampUsec: 1609459200000000 }]),
            'keep_notes.json'
          ),
        ];

        const result = await parseGoogleData(files);

        expect(result.events).toHaveLength(2); // calendar + keep note
        expect(result.stats.processedFiles).toBe(2);
        expect(result.stats.skipped).toBe(2); // html + jpg
        expect(result.errors).toHaveLength(0);
      });

      it('correctly reports total files count', async () => {
        const files = [
          createMockFile('<html></html>', 'index.html', 'text/html'),
          createMockFile('{}', 'data.json'),
          createMockFile('image', 'photo.png', 'image/png'),
        ];

        const result = await parseGoogleData(files);

        expect(result.stats.totalFiles).toBe(3);
      });
    });

    describe('Location data files', () => {
      it('parses location history JSON', async () => {
        const locationFile = createMockFile(
          JSON.stringify({
            locations: [
              { timestampMs: '1609459200000', latitudeE7: 407749950, longitudeE7: -740059730 }
            ]
          }),
          'Location History.json'
        );

        const result = await parseGoogleData([locationFile]);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].layer).toBe('travel');
      });

      it('parses semantic location history', async () => {
        const semanticFile = createMockFile(
          JSON.stringify({
            locations: [
              { timestampMs: '1609459200000', latitudeE7: 407749950, longitudeE7: -740059730 }
            ]
          }),
          'Semantic Location History.json'
        );

        const result = await parseGoogleData([semanticFile]);

        expect(result.events).toHaveLength(1);
      });

      it('parses timeline edits', async () => {
        const timelineFile = createMockFile(
          JSON.stringify({
            locations: [
              { timestampMs: '1609459200000', latitudeE7: 407749950, longitudeE7: -740059730 }
            ]
          }),
          'Timeline Edits.json'
        );

        const result = await parseGoogleData([timelineFile]);

        expect(result.events).toHaveLength(1);
      });
    });
  });
});
