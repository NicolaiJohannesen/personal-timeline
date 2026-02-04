import { describe, it, expect } from 'vitest';
import { parseICalData, parseICalText } from '@/lib/import/ical';

// Helper to create a mock ICS file
function createMockIcsFile(content: string, name = 'calendar.ics'): File {
  const file = new File([content], name, { type: 'text/calendar' });
  (file as ReturnType<typeof Object>).text = async () => content;
  return file;
}

describe('iCal Parser', () => {
  describe('parseICalText', () => {
    it('parses a simple event', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-event-1@example.com
SUMMARY:Team Meeting
DTSTART:20230615T100000Z
DTEND:20230615T110000Z
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].summary).toBe('Team Meeting');
      expect(result.events[0].uid).toBe('test-event-1@example.com');
      expect(result.events[0].dtstart).toBeInstanceOf(Date);
      expect(result.events[0].dtend).toBeInstanceOf(Date);
    });

    it('parses all-day events', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:all-day-1@example.com
SUMMARY:Birthday
DTSTART;VALUE=DATE:20230615
DTEND;VALUE=DATE:20230616
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].allDay).toBe(true);
      expect(result.events[0].dtstart?.getDate()).toBe(15);
    });

    it('parses event with description and location', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:detailed-1@example.com
SUMMARY:Conference
DESCRIPTION:Annual tech conference
LOCATION:Convention Center\\, San Francisco
DTSTART:20230915T090000Z
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].description).toBe('Annual tech conference');
      expect(result.events[0].location).toBe('Convention Center, San Francisco');
    });

    it('handles escaped characters', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:escaped-1@example.com
SUMMARY:Meeting\\, Important
DESCRIPTION:Line 1\\nLine 2\\nLine 3
DTSTART:20230701T140000Z
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events[0].summary).toBe('Meeting, Important');
      expect(result.events[0].description).toBe('Line 1\nLine 2\nLine 3');
    });

    it('parses recurring events', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:recurring-1@example.com
SUMMARY:Weekly Standup
DTSTART:20230101T100000Z
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
    });

    it('parses events with categories', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:categorized-1@example.com
SUMMARY:Project Planning
DTSTART:20230801T100000Z
CATEGORIES:Work,Planning,Important
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events[0].categories).toEqual(['Work', 'Planning', 'Important']);
    });

    it('parses events with organizer and attendees', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:meeting-1@example.com
SUMMARY:Team Sync
DTSTART:20230815T150000Z
ORGANIZER:mailto:boss@example.com
ATTENDEE:mailto:alice@example.com
ATTENDEE:mailto:bob@example.com
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events[0].organizer).toBe('boss@example.com');
      expect(result.events[0].attendees).toContain('alice@example.com');
      expect(result.events[0].attendees).toContain('bob@example.com');
    });

    it('handles folded lines (long content)', () => {
      // In iCal, folded lines have the continuation indicator (space/tab) which is removed.
      // So we expect "multiplelines" (no space) since the original lacks a trailing space.
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:folded-1@example.com
SUMMARY:This is a very long summary that spans multiple
 lines in the ICS file format
DTSTART:20230901T100000Z
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events[0].summary).toBe(
        'This is a very long summary that spans multiplelines in the ICS file format'
      );
    });

    it('parses multiple events', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1@example.com
SUMMARY:Event One
DTSTART:20230101T100000Z
END:VEVENT
BEGIN:VEVENT
UID:event-2@example.com
SUMMARY:Event Two
DTSTART:20230201T100000Z
END:VEVENT
BEGIN:VEVENT
UID:event-3@example.com
SUMMARY:Event Three
DTSTART:20230301T100000Z
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events).toHaveLength(3);
      expect(result.events.map(e => e.summary)).toEqual(['Event One', 'Event Two', 'Event Three']);
    });

    it('handles local time format', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:local-time-1@example.com
SUMMARY:Local Event
DTSTART:20230615T100000
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events[0].dtstart?.getHours()).toBe(10);
    });

    it('handles timezone-specified time', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tz-1@example.com
SUMMARY:New York Event
DTSTART;TZID=America/New_York:20230615T100000
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].dtstart).toBeInstanceOf(Date);
    });

    it('skips events without DTSTART', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:no-date-1@example.com
SUMMARY:Event without date
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events).toHaveLength(0);
    });

    it('parses event status', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:confirmed-1@example.com
SUMMARY:Confirmed Meeting
DTSTART:20230615T100000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      const result = parseICalText(ics);

      expect(result.events[0].status).toBe('CONFIRMED');
    });
  });

  describe('parseICalData', () => {
    it('processes File objects', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:file-event-1@example.com
SUMMARY:File Event
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('File Event');
      expect(result.events[0].source).toBe('ical');
      expect(result.stats.processedFiles).toBe(1);
    });

    it('handles multiple ICS files', async () => {
      const ics1 = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:cal1-event@example.com
SUMMARY:Calendar 1 Event
DTSTART:20230101T100000Z
END:VEVENT
END:VCALENDAR`;

      const ics2 = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:cal2-event@example.com
SUMMARY:Calendar 2 Event
DTSTART:20230201T100000Z
END:VEVENT
END:VCALENDAR`;

      const files = [createMockIcsFile(ics1, 'work.ics'), createMockIcsFile(ics2, 'personal.ics')];

      const result = await parseICalData(files);

      expect(result.events).toHaveLength(2);
      expect(result.stats.processedFiles).toBe(2);
    });

    it('skips cancelled events', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:cancelled-1@example.com
SUMMARY:Cancelled Meeting
DTSTART:20230615T100000Z
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.events).toHaveLength(0);
    });

    it('categorizes work events', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:work-1@example.com
SUMMARY:Team Meeting
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.events[0].layer).toBe('work');
    });

    it('categorizes travel events', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:travel-1@example.com
SUMMARY:Flight to Paris
LOCATION:JFK Airport
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.events[0].layer).toBe('travel');
    });

    it('categorizes health events', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:health-1@example.com
SUMMARY:Doctor Appointment
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.events[0].layer).toBe('health');
    });

    it('categorizes education events', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:edu-1@example.com
SUMMARY:Calculus Lecture
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.events[0].layer).toBe('education');
    });

    it('preserves event metadata', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:meta-1@example.com
SUMMARY:All Day Trip
DTSTART;VALUE=DATE:20230615
RRULE:FREQ=YEARLY
CATEGORIES:Travel,Personal
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.events[0].metadata).toMatchObject({
        allDay: true,
        recurring: true,
        rrule: 'FREQ=YEARLY',
        categories: ['Travel', 'Personal'],
        status: 'CONFIRMED',
      });
    });

    it('sets event type based on properties', async () => {
      const icsAllDay = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:allday-1@example.com
SUMMARY:Holiday
DTSTART;VALUE=DATE:20230704
END:VEVENT
END:VCALENDAR`;

      const icsRecurring = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:recurring-1@example.com
SUMMARY:Weekly Sync
DTSTART:20230615T100000Z
RRULE:FREQ=WEEKLY
END:VEVENT
END:VCALENDAR`;

      const allDayResult = await parseICalData([createMockIcsFile(icsAllDay)]);
      const recurringResult = await parseICalData([createMockIcsFile(icsRecurring)]);

      expect(allDayResult.events[0].eventType).toBe('all_day_event');
      expect(recurringResult.events[0].eventType).toBe('recurring_event');
    });

    it('calculates stats correctly', async () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:stat-1@example.com
SUMMARY:Work Meeting
DTSTART:20230601T100000Z
END:VEVENT
BEGIN:VEVENT
UID:stat-2@example.com
SUMMARY:Doctor Visit
DTSTART:20230602T100000Z
END:VEVENT
BEGIN:VEVENT
UID:stat-3@example.com
SUMMARY:Flight
LOCATION:Airport
DTSTART:20230603T100000Z
END:VEVENT
END:VCALENDAR`;

      const file = createMockIcsFile(ics);
      const result = await parseICalData([file]);

      expect(result.stats.totalEvents).toBe(3);
      expect(result.stats.eventsByLayer).toMatchObject({
        work: 1,
        health: 1,
        travel: 1,
      });
    });
  });

  describe('Edge cases', () => {
    describe('Empty and malformed content', () => {
      it('handles empty file', () => {
        const result = parseICalText('');
        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('handles file with only whitespace', () => {
        const result = parseICalText('   \n\n\t\t\n   ');
        expect(result.events).toHaveLength(0);
      });

      it('handles calendar with no events', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events).toHaveLength(0);
      });

      it('handles event without END:VEVENT', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:incomplete@example.com
SUMMARY:Incomplete Event
DTSTART:20230615T100000Z
END:VCALENDAR`;
        const result = parseICalText(ics);
        // Event without proper closing should be captured or skipped gracefully
        expect(result.events).toHaveLength(0);
      });

      it('handles nested BEGIN:VEVENT (invalid)', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:outer@example.com
SUMMARY:Outer Event
DTSTART:20230615T100000Z
BEGIN:VEVENT
UID:inner@example.com
SUMMARY:Inner Event
DTSTART:20230616T100000Z
END:VEVENT
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        // Should handle gracefully (parse what it can)
        expect(result.events.length).toBeGreaterThanOrEqual(1);
      });

      it('handles lines without colons', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:test@example.com
THIS_LINE_HAS_NO_COLON
SUMMARY:Valid Event
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events).toHaveLength(1);
      });
    });

    describe('Date and time edge cases', () => {
      it('handles midnight UTC', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:midnight@example.com
SUMMARY:Midnight Event
DTSTART:20230615T000000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].dtstart?.getUTCHours()).toBe(0);
        expect(result.events[0].dtstart?.getUTCMinutes()).toBe(0);
      });

      it('handles end of day', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:endofday@example.com
SUMMARY:Late Event
DTSTART:20230615T235959Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].dtstart?.getUTCHours()).toBe(23);
        expect(result.events[0].dtstart?.getUTCMinutes()).toBe(59);
      });

      it('handles year boundary (New Years Eve)', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:newyear@example.com
SUMMARY:New Year Party
DTSTART:20231231T230000Z
DTEND:20240101T030000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].dtstart?.getUTCFullYear()).toBe(2023);
        expect(result.events[0].dtend?.getUTCFullYear()).toBe(2024);
      });

      it('handles leap year date', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:leapyear@example.com
SUMMARY:Leap Day Event
DTSTART;VALUE=DATE:20240229
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].dtstart?.getDate()).toBe(29);
        expect(result.events[0].dtstart?.getMonth()).toBe(1); // February
      });

      it('handles very old dates', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:old@example.com
SUMMARY:Historical Event
DTSTART:19000101T000000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        // Events before 1970 are filtered out for date validation safety
        expect(result.events).toHaveLength(0);
      });

      it('handles far future dates', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:future@example.com
SUMMARY:Future Event
DTSTART:20991231T235959Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        // Note: Due to UTC conversion, this may show as 2100 in local time
        expect(result.events[0].dtstart?.getUTCFullYear()).toBe(2099);
      });

      it('handles invalid date format gracefully', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:invalid-date@example.com
SUMMARY:Bad Date Event
DTSTART:NOT-A-DATE
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        // Event should be skipped due to invalid date
        expect(result.events).toHaveLength(0);
      });

      it('handles date without time (all-day)', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:dateonly@example.com
SUMMARY:All Day
DTSTART:20230615
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].allDay).toBe(true);
      });
    });

    describe('Unicode and special characters', () => {
      it('handles unicode in summary', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:unicode@example.com
SUMMARY:会议 - Réunion - Встреча - 📅
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].summary).toContain('会议');
        expect(result.events[0].summary).toContain('Réunion');
        expect(result.events[0].summary).toContain('📅');
      });

      it('handles unicode in location', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:unicode-loc@example.com
SUMMARY:Meeting
LOCATION:東京都渋谷区 - Café München
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].location).toContain('東京都');
        expect(result.events[0].location).toContain('München');
      });

      it('handles backslash escapes', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:escape@example.com
SUMMARY:Test\\nNewline\\,Comma\\;Semi
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].summary).toContain('\n');
        expect(result.events[0].summary).toContain(',');
        expect(result.events[0].summary).toContain(';');
      });

      it('handles very long summary', () => {
        const longSummary = 'A'.repeat(5000);
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:long@example.com
SUMMARY:${longSummary}
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        // Security: summaries are truncated to 500 chars to prevent memory issues
        expect(result.events[0].summary?.length).toBe(500);
      });

      it('handles very long description', () => {
        const longDesc = 'Line of text. '.repeat(1000);
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:longdesc@example.com
SUMMARY:Event
DESCRIPTION:${longDesc}
DTSTART:20230615T100000Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        // Security: descriptions are truncated to 10000 chars to prevent memory issues
        expect(result.events[0].description?.length).toBe(10000);
      });
    });

    describe('RRULE edge cases', () => {
      it('handles daily recurrence', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:daily@example.com
SUMMARY:Daily Standup
DTSTART:20230615T090000Z
RRULE:FREQ=DAILY;COUNT=30
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].rrule).toBe('FREQ=DAILY;COUNT=30');
      });

      it('handles complex recurrence rule', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:complex@example.com
SUMMARY:Complex Recurring
DTSTART:20230615T100000Z
RRULE:FREQ=MONTHLY;BYDAY=2TU;BYMONTH=1,4,7,10;UNTIL=20251231T235959Z
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].rrule).toContain('FREQ=MONTHLY');
        expect(result.events[0].rrule).toContain('BYDAY=2TU');
      });
    });

    describe('Multiple attendees and properties', () => {
      it('handles many attendees', () => {
        const attendees = Array.from({ length: 50 }, (_, i) => `ATTENDEE:mailto:user${i}@example.com`).join('\n');
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:manyattendees@example.com
SUMMARY:Large Meeting
DTSTART:20230615T100000Z
${attendees}
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].attendees?.length).toBe(50);
      });

      it('handles many categories', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:manycats@example.com
SUMMARY:Multi-category Event
DTSTART:20230615T100000Z
CATEGORIES:Work,Personal,Important,Urgent,Meeting,Project,Team,Q1,Budget,Review
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events[0].categories?.length).toBe(10);
      });
    });

    describe('Windows line endings', () => {
      it('handles CRLF line endings', () => {
        const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:crlf@example.com\r\nSUMMARY:CRLF Event\r\nDTSTART:20230615T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
        const result = parseICalText(ics);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].summary).toBe('CRLF Event');
      });

      it('handles mixed line endings', () => {
        const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\r\nUID:mixed@example.com\nSUMMARY:Mixed Endings\r\nDTSTART:20230615T100000Z\nEND:VEVENT\r\nEND:VCALENDAR';
        const result = parseICalText(ics);
        expect(result.events).toHaveLength(1);
      });
    });

    describe('Property parameters', () => {
      it('handles multiple parameters on DTSTART', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:params@example.com
SUMMARY:Parameterized Event
DTSTART;VALUE=DATE-TIME;TZID=America/New_York:20230615T100000
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].allDay).toBe(false);
      });

      it('handles quoted parameter values', () => {
        const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:quoted@example.com
SUMMARY:Quoted Params
DTSTART;TZID="America/Los Angeles":20230615T100000
END:VEVENT
END:VCALENDAR`;
        const result = parseICalText(ics);
        expect(result.events).toHaveLength(1);
      });
    });
  });
});
