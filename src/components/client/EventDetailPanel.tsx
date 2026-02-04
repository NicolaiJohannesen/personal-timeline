'use client';

import { useState } from 'react';
import { timelineEvents } from '@/lib/db';
import type { TimelineEvent, DataLayer, EventSource } from '@/types';

const LAYER_OPTIONS: { value: DataLayer; label: string }[] = [
  { value: 'economics', label: 'Economics' },
  { value: 'education', label: 'Education' },
  { value: 'work', label: 'Work' },
  { value: 'health', label: 'Health' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'travel', label: 'Travel' },
  { value: 'media', label: 'Media' },
];

const SOURCE_OPTIONS: { value: EventSource; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google', label: 'Google' },
  { value: 'other', label: 'Other' },
];

const LAYER_COLORS: Record<DataLayer, string> = {
  economics: 'var(--color-layer-economics)',
  education: 'var(--color-layer-education)',
  work: 'var(--color-layer-work)',
  health: 'var(--color-layer-health)',
  relationships: 'var(--color-layer-relationships)',
  travel: 'var(--color-layer-travel)',
  media: 'var(--color-layer-media)',
};

interface EventDetailPanelProps {
  event: TimelineEvent;
  onClose: () => void;
  onUpdate?: (event: TimelineEvent) => void;
  onDelete?: (eventId: string) => void;
}

export function EventDetailPanel({
  event,
  onClose,
  onUpdate,
  onDelete,
}: EventDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description || '',
    startDate: formatDateForInput(event.startDate),
    endDate: event.endDate ? formatDateForInput(event.endDate) : '',
    layer: event.layer,
    eventType: event.eventType,
    source: event.source,
  });

  function formatDateForInput(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  function formatDateForDisplay(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedEvent: TimelineEvent = {
        ...event,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        layer: formData.layer,
        eventType: formData.eventType,
        source: formData.source,
        updatedAt: new Date(),
      };

      await timelineEvents.update(updatedEvent);
      onUpdate?.(updatedEvent);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update event:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await timelineEvents.delete(event.id);
      onDelete?.(event.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError('Failed to delete event. Please try again.');
      setIsDeleting(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      title: event.title,
      description: event.description || '',
      startDate: formatDateForInput(event.startDate),
      endDate: event.endDate ? formatDateForInput(event.endDate) : '',
      layer: event.layer,
      eventType: event.eventType,
      source: event.source,
    });
    setIsEditing(false);
    setIsDeleting(false);
    setError(null);
  };

  // Delete confirmation view
  if (isDeleting) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="card-elevated max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Delete Event?</h3>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete &quot;{event.title}&quot;? This action cannot be undone.
            </p>

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="btn bg-red-500 hover:bg-red-600 text-white"
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit form view
  if (isEditing) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="card-elevated max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Edit Event</h3>
            <button
              onClick={handleCancel}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                placeholder="Event title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)] resize-none"
                placeholder="Optional description"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
            </div>

            {/* Layer */}
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={formData.layer}
                onChange={(e) => setFormData((prev) => ({ ...prev, layer: e.target.value as DataLayer }))}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
              >
                {LAYER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium mb-1">Event Type</label>
              <input
                type="text"
                value={formData.eventType}
                onChange={(e) => setFormData((prev) => ({ ...prev, eventType: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                placeholder="e.g., job_start, trip, appointment"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium mb-1">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value as EventSource }))}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary flex-1"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default detail view
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="card-elevated max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: `color-mix(in srgb, ${LAYER_COLORS[event.layer]} 20%, transparent)`,
                  color: LAYER_COLORS[event.layer],
                }}
              >
                {LAYER_OPTIONS.find((l) => l.value === event.layer)?.label}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] capitalize">
                {event.source}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-[var(--color-text-secondary)] mb-4">{event.description}</p>
        )}

        {/* Dates */}
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-[var(--color-text-primary)]">
              {formatDateForDisplay(event.startDate)}
            </span>
          </div>
          {event.endDate && (
            <div className="flex items-center gap-2 text-sm mt-2">
              <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span className="text-[var(--color-text-secondary)]">
                {formatDateForDisplay(event.endDate)}
              </span>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="text-xs text-[var(--color-text-muted)] mb-6">
          <div>Event Type: {event.eventType}</div>
          <div>Created: {formatDateForDisplay(event.createdAt)}</div>
          {event.updatedAt && event.updatedAt !== event.createdAt && (
            <div>Updated: {formatDateForDisplay(event.updatedAt)}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </button>
          <button
            onClick={() => setIsDeleting(true)}
            className="btn btn-secondary flex-1 flex items-center justify-center gap-2 text-red-500 hover:bg-red-500/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
