import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportWizard } from '@/components/client/ImportWizard';

// Mock the db module
vi.mock('@/lib/db', () => ({
  timelineEvents: {
    add: vi.fn().mockResolvedValue(undefined),
    addBatch: vi.fn().mockImplementation((events) => Promise.resolve(events || [])),
  },
}));

// Mock the import parsers
vi.mock('@/lib/import', () => ({
  parseFacebookData: vi.fn().mockResolvedValue({
    events: [
      {
        title: 'Facebook Post',
        startDate: new Date('2021-01-15'),
        layer: 'media',
        eventType: 'post',
        source: 'facebook',
      },
    ],
    errors: [],
    stats: { totalFiles: 1, processedFiles: 1, totalEvents: 1, eventsByLayer: { media: 1 }, skipped: 0 },
  }),
  parseLinkedInData: vi.fn().mockResolvedValue({
    events: [
      {
        title: 'Software Engineer at Tech Corp',
        startDate: new Date('2020-01-01'),
        layer: 'work',
        eventType: 'job',
        source: 'linkedin',
      },
    ],
    errors: [],
    stats: { totalFiles: 1, processedFiles: 1, totalEvents: 1, eventsByLayer: { work: 1 }, skipped: 0 },
  }),
  parseGoogleData: vi.fn().mockResolvedValue({
    events: [
      {
        title: 'Team Meeting',
        startDate: new Date('2021-03-01'),
        layer: 'work',
        eventType: 'calendar_event',
        source: 'google',
      },
    ],
    errors: [],
    stats: { totalFiles: 1, processedFiles: 1, totalEvents: 1, eventsByLayer: { work: 1 }, skipped: 0 },
  }),
  parseCSVAuto: vi.fn().mockResolvedValue({
    events: [
      {
        title: 'Custom Event',
        startDate: new Date('2021-06-01'),
        layer: 'media',
        eventType: 'custom',
        source: 'other',
      },
    ],
    errors: [],
    stats: { totalFiles: 1, processedFiles: 1, totalEvents: 1, eventsByLayer: { media: 1 }, skipped: 0 },
  }),
  previewCSV: vi.fn().mockResolvedValue({ headers: [], rows: [] }),
}));

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  },
});

describe('ImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Source Selection (Step 1)', () => {
    it('renders all import sources', () => {
      render(<ImportWizard />);

      expect(screen.getByText('Facebook')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('Google Takeout')).toBeInTheDocument();
      expect(screen.getByText('Custom CSV')).toBeInTheDocument();
    });

    it('shows privacy notice', () => {
      render(<ImportWizard />);

      expect(screen.getByText('Your data stays on your device')).toBeInTheDocument();
    });

    it('navigates to upload step when source is selected', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      expect(screen.getByText('Upload Facebook Data')).toBeInTheDocument();
    });

    it('shows step indicators', () => {
      render(<ImportWizard />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('Upload Step (Step 2)', () => {
    it('shows instructions for selected source', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      expect(screen.getByText('How to export your data')).toBeInTheDocument();
      expect(screen.getByText(/Facebook Settings/)).toBeInTheDocument();
    });

    it('shows file upload area', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('LinkedIn'));

      expect(screen.getByText(/Drop ZIP archive or .csv files here/)).toBeInTheDocument();
    });

    it('can go back to source selection', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));
      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(screen.getByText('Choose a source to import your life data from')).toBeInTheDocument();
    });

    it('processes uploaded file and moves to preview', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      // Create a mock file
      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Mock file.text() for our test
      Object.defineProperty(file, 'text', {
        value: async () => '{}',
      });

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Review Import')).toBeInTheDocument();
      });
    });
  });

  describe('Preview Step (Step 3)', () => {
    it('shows import statistics', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Total Events')).toBeInTheDocument();
        expect(screen.getByText('Selected')).toBeInTheDocument();
      });
    });

    it('shows parsed events with checkboxes', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Facebook Post')).toBeInTheDocument();
      });

      // Should be a checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('allows selecting/deselecting all events', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deselect all/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /deselect all/i }));

      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });

    it('can go back to upload step', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Review Import')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(screen.getByText(/Upload Facebook Data/)).toBeInTheDocument();
    });
  });

  describe('Confirm Step (Step 4)', () => {
    it('shows success message after import', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Review Import')).toBeInTheDocument();
      });

      // Wait for button to be ready and click it
      const importButton = await screen.findByRole('button', { name: /import.*event/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('shows imported count', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Review Import')).toBeInTheDocument();
      });

      const importButton = await screen.findByRole('button', { name: /import.*event/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully imported 1 events/)).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('allows importing more data', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Review Import')).toBeInTheDocument();
      });

      const importButton = await screen.findByRole('button', { name: /import.*event/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      }, { timeout: 10000 });

      await user.click(screen.getByRole('button', { name: /import more/i }));

      expect(screen.getByText('Choose a source to import your life data from')).toBeInTheDocument();
    });

    it('has link to view timeline', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Facebook'));

      const file = new File(['{}'], 'data.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Review Import')).toBeInTheDocument();
      });

      const importButton = await screen.findByRole('button', { name: /import.*event/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /view timeline/i })).toHaveAttribute('href', '/timeline');
      }, { timeout: 10000 });
    });
  });

  describe('Different sources', () => {
    it('works with LinkedIn source', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('LinkedIn'));

      expect(screen.getByText('Upload LinkedIn Data')).toBeInTheDocument();

      const file = new File(['test'], 'positions.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'text', { value: async () => 'test' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Software Engineer at Tech Corp')).toBeInTheDocument();
      });
    });

    it('works with Google source', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Google Takeout'));

      expect(screen.getByText('Upload Google Takeout Data')).toBeInTheDocument();

      const file = new File(['{}'], 'calendar.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => '{}' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });
    });

    it('works with CSV source', async () => {
      const user = userEvent.setup();
      render(<ImportWizard />);

      await user.click(screen.getByText('Custom CSV'));

      expect(screen.getByText('Upload Custom CSV Data')).toBeInTheDocument();

      const file = new File(['Title,Date\nEvent,2021-01-01'], 'events.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'text', { value: async () => 'Title,Date\nEvent,2021-01-01' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Custom Event')).toBeInTheDocument();
      });
    });
  });
});
