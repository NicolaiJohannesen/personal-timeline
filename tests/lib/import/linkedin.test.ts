import { describe, it, expect } from 'vitest';
import { parseLinkedInObject } from '@/lib/import/linkedin';
import { parseCSV } from '@/lib/import/csv';

describe('LinkedIn Parser', () => {
  describe('parseLinkedInObject', () => {
    describe('Positions', () => {
      it('parses job positions', () => {
        const data = {
          Positions: [
            {
              'Company Name': 'Tech Corp',
              Title: 'Software Engineer',
              'Started On': 'Jan 2020',
              'Finished On': 'Dec 2022',
              Description: 'Built amazing things',
              Location: 'San Francisco, CA',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Software Engineer at Tech Corp');
        expect(result.events[0].layer).toBe('work');
        expect(result.events[0].eventType).toBe('job');
        expect(result.events[0].source).toBe('linkedin');
        expect(result.events[0].description).toBe('Built amazing things');
        expect(result.events[0].location?.name).toBe('San Francisco, CA');
      });

      it('parses positions without title', () => {
        const data = {
          Positions: [
            {
              'Company Name': 'Startup Inc',
              'Started On': 'Mar 2018',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events[0].title).toBe('Worked at Startup Inc');
      });

      it('parses positions with ongoing employment', () => {
        const data = {
          Positions: [
            {
              'Company Name': 'Current Corp',
              Title: 'Lead Developer',
              'Started On': 'Jan 2023',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events[0].endDate).toBeUndefined();
      });

      it('parses various date formats', () => {
        const data = {
          Positions: [
            { 'Company Name': 'A', 'Started On': 'Jan 2020' },
            { 'Company Name': 'B', 'Started On': '2019' },
            { 'Company Name': 'C', 'Started On': '2018-06-15' },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events).toHaveLength(3);
        expect(result.events[0].startDate.getFullYear()).toBe(2020);
        expect(result.events[0].startDate.getMonth()).toBe(0); // January
        expect(result.events[1].startDate.getFullYear()).toBe(2019);
        expect(result.events[2].startDate.getFullYear()).toBe(2018);
      });

      it('skips positions without company name', () => {
        const data = {
          Positions: [
            { Title: 'Engineer', 'Started On': 'Jan 2020' },
            { 'Company Name': 'Valid', 'Started On': 'Jan 2020' },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events).toHaveLength(1);
      });

      it('skips positions without start date', () => {
        const data = {
          Positions: [
            { 'Company Name': 'No Date' },
            { 'Company Name': 'Valid', 'Started On': 'Jan 2020' },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events).toHaveLength(1);
      });
    });

    describe('Education', () => {
      it('parses education entries', () => {
        const data = {
          Education: [
            {
              'School Name': 'MIT',
              'Degree Name': 'BS Computer Science',
              'Start Date': 'Sep 2010',
              'End Date': 'May 2014',
              Notes: 'Focus on AI',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('BS Computer Science at MIT');
        expect(result.events[0].layer).toBe('education');
        expect(result.events[0].eventType).toBe('degree');
        expect(result.events[0].description).toBe('Focus on AI');
      });

      it('parses education without degree', () => {
        const data = {
          Education: [
            {
              'School Name': 'State University',
              'Start Date': 'Sep 2006',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events[0].title).toBe('Studied at State University');
      });

      it('stores metadata correctly', () => {
        const data = {
          Education: [
            {
              'School Name': 'Harvard',
              'Degree Name': 'MBA',
              'Start Date': '2015',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events[0].metadata?.school).toBe('Harvard');
        expect(result.events[0].metadata?.degree).toBe('MBA');
      });
    });

    describe('Connections', () => {
      it('parses connections', () => {
        const data = {
          Connections: [
            {
              'First Name': 'John',
              'Last Name': 'Doe',
              'Connected On': '15 Jan 2021',
              Company: 'Tech Corp',
              Position: 'CEO',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe('Connected with John Doe');
        expect(result.events[0].layer).toBe('relationships');
        expect(result.events[0].eventType).toBe('connection');
        expect(result.events[0].description).toBe('CEO at Tech Corp');
      });

      it('handles connections without last name', () => {
        const data = {
          Connections: [
            {
              'First Name': 'Alice',
              'Connected On': '2021-01-15',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events[0].title).toBe('Connected with Alice');
      });

      it('handles connections without company', () => {
        const data = {
          Connections: [
            {
              'First Name': 'Bob',
              'Last Name': 'Smith',
              'Connected On': '2021-01-15',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events[0].description).toBeUndefined();
      });

      it('stores connection metadata', () => {
        const data = {
          Connections: [
            {
              'First Name': 'Jane',
              'Last Name': 'Doe',
              'Connected On': '2021-01-15',
              Company: 'Startup',
              Position: 'CTO',
            },
          ],
        };

        const result = parseLinkedInObject(data);

        expect(result.events[0].metadata?.name).toBe('Jane Doe');
        expect(result.events[0].metadata?.company).toBe('Startup');
        expect(result.events[0].metadata?.position).toBe('CTO');
      });
    });

    describe('Combined data', () => {
      it('parses all data types together', () => {
        const data = {
          Positions: [{ 'Company Name': 'Corp', 'Started On': '2020' }],
          Education: [{ 'School Name': 'Uni', 'Start Date': '2015' }],
          Connections: [{ 'First Name': 'John', 'Connected On': '2021-01-01' }],
        };

        const result = parseLinkedInObject(data);

        expect(result.events).toHaveLength(3);
        expect(result.events.filter((e) => e.layer === 'work')).toHaveLength(1);
        expect(result.events.filter((e) => e.layer === 'education')).toHaveLength(1);
        expect(result.events.filter((e) => e.layer === 'relationships')).toHaveLength(1);
      });

      it('handles empty data', () => {
        const result = parseLinkedInObject({});

        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('parseCSV', () => {
    it('parses basic CSV', () => {
      const csv = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA';
      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ Name: 'John', Age: '30', City: 'NYC' });
      expect(result[1]).toEqual({ Name: 'Jane', Age: '25', City: 'LA' });
    });

    it('handles quoted fields', () => {
      const csv = 'Name,Bio\nJohn,"Hello, World"\nJane,"She said ""hi"""';
      const result = parseCSV(csv);

      expect(result[0].Bio).toBe('Hello, World');
      expect(result[1].Bio).toBe('She said "hi"');
    });

    it('handles empty fields', () => {
      const csv = 'A,B,C\n1,,3\n,,';
      const result = parseCSV(csv);

      expect(result[0]).toEqual({ A: '1', B: '', C: '3' });
      expect(result[1]).toEqual({ A: '', B: '', C: '' });
    });

    it('trims whitespace', () => {
      const csv = 'Name , Age \n John , 30 ';
      const result = parseCSV(csv);

      expect(result[0]).toEqual({ Name: 'John', Age: '30' });
    });

    it('handles empty CSV', () => {
      const result = parseCSV('');
      expect(result).toHaveLength(0);
    });

    it('handles headers only', () => {
      const csv = 'A,B,C';
      const result = parseCSV(csv);
      expect(result).toHaveLength(0);
    });
  });
});
