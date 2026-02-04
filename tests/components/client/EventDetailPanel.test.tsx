import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventDetailPanel } from '@/components/client/EventDetailPanel';
import type { TimelineEvent } from '@/types';

// Mock the db module
vi.mock('@/lib/db', () => ({
  timelineEvents: {
    update: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  },
}));

import { timelineEvents } from '@/lib/db';

const mockEvent: TimelineEvent = {
  id: 'test-event-1',
  userId: 'test-user',
  title: 'Test Event',
  description: 'A test event description',
  startDate: new Date('2023-06-15'),
  endDate: new Date('2023-06-20'),
  layer: 'work',
  eventType: 'job_start',
  source: 'manual',
  createdAt: new Date('2023-06-01'),
  updatedAt: new Date('2023-06-10'),
};

describe('EventDetailPanel', () => {
  const mockOnClose = vi.fn();
  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('View Mode', () => {
    it('renders event details correctly', () => {
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('A test event description')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('manual')).toBeInTheDocument();
    });

    it('displays formatted dates', () => {
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/Thursday, June 15, 2023/)).toBeInTheDocument();
      expect(screen.getByText(/Tuesday, June 20, 2023/)).toBeInTheDocument();
    });

    it('displays event metadata', () => {
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/Event Type: job_start/)).toBeInTheDocument();
      expect(screen.getByText(/Created:/)).toBeInTheDocument();
    });

    it('shows Edit and Delete buttons', () => {
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByLabelText('Close'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking overlay backdrop', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      // Click the backdrop (the outer div with onClick={onClose})
      const backdrop = screen.getByText('Test Event').closest('.fixed');
      if (backdrop) {
        await user.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('handles events without description', () => {
      const eventWithoutDescription = { ...mockEvent, description: undefined };
      render(
        <EventDetailPanel
          event={eventWithoutDescription}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.queryByText('A test event description')).not.toBeInTheDocument();
    });

    it('handles events without end date', () => {
      const eventWithoutEndDate = { ...mockEvent, endDate: undefined };
      render(
        <EventDetailPanel
          event={eventWithoutEndDate}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/Thursday, June 15, 2023/)).toBeInTheDocument();
      expect(screen.queryByText(/Tuesday, June 20, 2023/)).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('switches to edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByText('Edit Event')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test event description')).toBeInTheDocument();
    });

    it('allows editing the title', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const titleInput = screen.getByDisplayValue('Test Event');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Event Title');

      expect(screen.getByDisplayValue('Updated Event Title')).toBeInTheDocument();
    });

    it('allows editing the description', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const descInput = screen.getByDisplayValue('A test event description');
      await user.clear(descInput);
      await user.type(descInput, 'New description');

      expect(screen.getByDisplayValue('New description')).toBeInTheDocument();
    });

    it('saves changes and calls onUpdate', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const titleInput = screen.getByDisplayValue('Test Event');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(timelineEvents.update).toHaveBeenCalled();
        expect(mockOnUpdate).toHaveBeenCalled();
      });
    });

    it('validates that title is required', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const titleInput = screen.getByDisplayValue('Test Event');
      await user.clear(titleInput);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(timelineEvents.update).not.toHaveBeenCalled();
    });

    it('cancels edit and returns to view mode', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByText('Edit Event')).toBeInTheDocument();

      const titleInput = screen.getByDisplayValue('Test Event');
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Title');

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Should be back to view mode with original title
      expect(screen.queryByText('Edit Event')).not.toBeInTheDocument();
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    it('allows changing the layer/category', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const layerSelect = screen.getByDisplayValue('Work');
      await user.selectOptions(layerSelect, 'travel');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(timelineEvents.update).toHaveBeenCalledWith(
          expect.objectContaining({ layer: 'travel' })
        );
      });
    });

    it('allows changing the source', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const sourceSelect = screen.getByDisplayValue('Manual');
      await user.selectOptions(sourceSelect, 'facebook');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(timelineEvents.update).toHaveBeenCalledWith(
          expect.objectContaining({ source: 'facebook' })
        );
      });
    });

    it('handles save error gracefully', async () => {
      vi.mocked(timelineEvents.update).mockRejectedValueOnce(new Error('Save failed'));
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to save changes/)).toBeInTheDocument();
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Delete Mode', () => {
    it('shows delete confirmation when Delete button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(screen.getByText('Delete Event?')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
      expect(screen.getByText(/"Test Event"/)).toBeInTheDocument();
    });

    it('deletes event and calls onDelete when confirmed', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      // Click the Delete button in the confirmation dialog
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      const confirmDeleteButton = deleteButtons.find(btn => btn.textContent === 'Delete');
      await user.click(confirmDeleteButton!);

      await waitFor(() => {
        expect(timelineEvents.delete).toHaveBeenCalledWith('test-event-1');
        expect(mockOnDelete).toHaveBeenCalledWith('test-event-1');
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('cancels delete and returns to view mode', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));
      expect(screen.getByText('Delete Event?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Should be back to view mode
      expect(screen.queryByText('Delete Event?')).not.toBeInTheDocument();
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    it('handles delete error gracefully', async () => {
      vi.mocked(timelineEvents.delete).mockRejectedValueOnce(new Error('Delete failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      const confirmDeleteButton = deleteButtons.find(btn => btn.textContent === 'Delete');
      await user.click(confirmDeleteButton!);

      // Component exits delete mode on error, returning to view mode
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to delete event:', expect.any(Error));
      });
      // Event should still be displayed (not deleted)
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(mockOnDelete).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('shows deleting state while processing', async () => {
      vi.mocked(timelineEvents.delete).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      const confirmDeleteButton = deleteButtons.find(btn => btn.textContent === 'Delete');
      await user.click(confirmDeleteButton!);

      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });
  });

  describe('Optional callbacks', () => {
    it('works without onUpdate callback', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(timelineEvents.update).toHaveBeenCalled();
      });
      // Should not throw error even without onUpdate
    });

    it('works without onDelete callback', async () => {
      const user = userEvent.setup();
      render(
        <EventDetailPanel
          event={mockEvent}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      const confirmDeleteButton = deleteButtons.find(btn => btn.textContent === 'Delete');
      await user.click(confirmDeleteButton!);

      await waitFor(() => {
        expect(timelineEvents.delete).toHaveBeenCalled();
      });
      // Should not throw error even without onDelete
    });
  });

  describe('Different layer types', () => {
    const layers = ['economics', 'education', 'work', 'health', 'relationships', 'travel', 'media'] as const;

    layers.forEach((layer) => {
      it(`displays ${layer} layer correctly`, () => {
        const eventWithLayer = { ...mockEvent, layer };
        render(
          <EventDetailPanel
            event={eventWithLayer}
            onClose={mockOnClose}
            onUpdate={mockOnUpdate}
            onDelete={mockOnDelete}
          />
        );

        const layerLabel = layer.charAt(0).toUpperCase() + layer.slice(1);
        expect(screen.getByText(layerLabel)).toBeInTheDocument();
      });
    });
  });

  describe('Different source types', () => {
    const sources = ['manual', 'facebook', 'linkedin', 'google', 'other'] as const;

    sources.forEach((source) => {
      it(`displays ${source} source correctly`, () => {
        const eventWithSource = { ...mockEvent, source };
        render(
          <EventDetailPanel
            event={eventWithSource}
            onClose={mockOnClose}
            onUpdate={mockOnUpdate}
            onDelete={mockOnDelete}
          />
        );

        expect(screen.getByText(source)).toBeInTheDocument();
      });
    });
  });
});
