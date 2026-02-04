'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TimelineCanvas } from './TimelineCanvas';
import { EventDetailPanel } from './EventDetailPanel';
import { timelineEvents, userProfile, goals as goalsDb } from '@/lib/db';
import type { TimelineEvent, DataLayer, EventSource, Goal } from '@/types';
import { exportCanvasAsPNG, exportTimelineJSON } from '@/lib/utils/timelineExport';
import { exportTimelinePDF } from '@/lib/utils/pdfExport';

const ALL_LAYERS: DataLayer[] = [
  'economics',
  'education',
  'work',
  'health',
  'relationships',
  'travel',
  'media',
];

const ALL_SOURCES: EventSource[] = [
  'manual', 'facebook', 'instagram', 'linkedin', 'google', 'ical', 'spotify', 'apple', 'other'
];

const LAYER_INFO: Record<DataLayer, { label: string; badgeClass: string }> = {
  economics: { label: 'Economics', badgeClass: 'badge-economics' },
  education: { label: 'Education', badgeClass: 'badge-education' },
  work: { label: 'Work', badgeClass: 'badge-work' },
  health: { label: 'Health', badgeClass: 'badge-health' },
  relationships: { label: 'Relationships', badgeClass: 'badge-relationships' },
  travel: { label: 'Travel', badgeClass: 'badge-travel' },
  media: { label: 'Media', badgeClass: 'badge-media' },
};

const SOURCE_INFO: Record<EventSource, { label: string; icon: string }> = {
  manual: { label: 'Manual', icon: '✏️' },
  facebook: { label: 'Facebook', icon: '📘' },
  instagram: { label: 'Instagram', icon: '📷' },
  linkedin: { label: 'LinkedIn', icon: '💼' },
  google: { label: 'Google', icon: '🔍' },
  ical: { label: 'iCal', icon: '📅' },
  spotify: { label: 'Spotify', icon: '🎵' },
  apple: { label: 'Apple', icon: '🍎' },
  other: { label: 'Other', icon: '📁' },
};

export function TimelineView() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<DataLayer[]>(ALL_LAYERS);
  const [visibleSources, setVisibleSources] = useState<EventSource[]>(ALL_SOURCES);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [birthYear, setBirthYear] = useState(1992);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    work: 0,
    travel: 0,
    relationships: 0,
  });
  const [showMortalityCurve, setShowMortalityCurve] = useState(true);
  const [showFutureGoals, setShowFutureGoals] = useState(true);
  const [futureGoals, setFutureGoals] = useState<Goal[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load data from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventsData, profile, goalsData] = await Promise.all([
          timelineEvents.getAll(),
          userProfile.get(),
          goalsDb.getAll(),
        ]);

        setEvents(eventsData);
        setFutureGoals(goalsData);

        if (profile?.birthDate) {
          setBirthYear(new Date(profile.birthDate).getFullYear());
        }

        // Calculate stats
        setStats({
          total: eventsData.length,
          work: eventsData.filter((e) => e.layer === 'work').length,
          travel: eventsData.filter((e) => e.layer === 'travel').length,
          relationships: eventsData.filter((e) => e.layer === 'relationships').length,
        });
      } catch (error) {
        console.error('Failed to load timeline data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter events based on all criteria
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Layer filter
      if (!visibleLayers.includes(event.layer)) return false;

      // Source filter
      if (!visibleSources.includes(event.source)) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = event.title.toLowerCase().includes(query);
        const matchesDescription = event.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      // Date range filter
      const eventDate = new Date(event.startDate);
      if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        if (eventDate < startDate) return false;
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        if (eventDate > endDate) return false;
      }

      return true;
    });
  }, [events, visibleLayers, visibleSources, searchQuery, dateRange]);

  // Get unique sources from events
  const availableSources = useMemo(() => {
    const sources = new Set(events.map((e) => e.source));
    return ALL_SOURCES.filter((s) => sources.has(s));
  }, [events]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (visibleLayers.length !== ALL_LAYERS.length) count++;
    if (visibleSources.length !== availableSources.length) count++;
    if (searchQuery) count++;
    if (dateRange.start || dateRange.end) count++;
    return count;
  }, [visibleLayers, visibleSources, searchQuery, dateRange, availableSources]);

  const toggleLayer = (layer: DataLayer) => {
    setVisibleLayers((prev) =>
      prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]
    );
  };

  const toggleAllLayers = () => {
    setVisibleLayers((prev) =>
      prev.length === ALL_LAYERS.length ? [] : ALL_LAYERS
    );
  };

  const toggleSource = (source: EventSource) => {
    setVisibleSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const toggleAllSources = () => {
    setVisibleSources((prev) =>
      prev.length === availableSources.length ? [] : availableSources
    );
  };

  const clearFilters = () => {
    setVisibleLayers(ALL_LAYERS);
    setVisibleSources(ALL_SOURCES);
    setSearchQuery('');
    setDateRange({ start: '', end: '' });
  };

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
  };

  const handleEventUpdate = (updatedEvent: TimelineEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    );
    setSelectedEvent(updatedEvent);
  };

  const handleEventDelete = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setSelectedEvent(null);
    // Update stats
    setStats((prev) => {
      const deletedEvent = events.find((e) => e.id === eventId);
      if (!deletedEvent) return prev;
      return {
        total: prev.total - 1,
        work: deletedEvent.layer === 'work' ? prev.work - 1 : prev.work,
        travel: deletedEvent.layer === 'travel' ? prev.travel - 1 : prev.travel,
        relationships: deletedEvent.layer === 'relationships' ? prev.relationships - 1 : prev.relationships,
      };
    });
  };

  // Export handlers
  const handleExportPNG = () => {
    if (canvasRef.current) {
      exportCanvasAsPNG(canvasRef.current, `timeline-${new Date().toISOString().split('T')[0]}.png`);
    }
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportTimelineJSON(
      events as unknown as Array<Record<string, unknown>>,
      null,
      futureGoals as unknown as Array<Record<string, unknown>>,
      `timeline-backup-${new Date().toISOString().split('T')[0]}.json`
    );
    setShowExportMenu(false);
  };

  const handleExportPDF = async () => {
    try {
      const profile = await userProfile.get();
      exportTimelinePDF({
        profile: profile ?? null,
        events,
        goals: futureGoals,
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
    setShowExportMenu(false);
  };

  if (isLoading) {
    return (
      <div className="fade-in">
        <div className="mb-8">
          <div className="h-9 w-48 bg-[var(--color-bg-secondary)] rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-[var(--color-bg-secondary)] rounded animate-pulse" />
        </div>
        <div className="card-elevated min-h-[500px] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Timeline</h1>
          <p className="text-[var(--color-text-secondary)]">
            Your life events visualized across time
          </p>
        </div>
        {events.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg z-20">
                <button
                  onClick={handleExportPNG}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)] rounded-t-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Export as PNG
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export as JSON
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)] rounded-b-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Print / Save as PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card mb-6">
        {/* Search and Quick Filters Row */}
        <div className="flex items-center gap-4 flex-wrap mb-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-accent-primary)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-secondary flex items-center gap-2 ${showFilters ? 'bg-[var(--color-accent-primary)]/20' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)] text-xs px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
            >
              Clear all
            </button>
          )}

          {/* Result Count */}
          <span className="text-sm text-[var(--color-text-muted)] ml-auto">
            {filteredEvents.length} of {events.length} events
          </span>
        </div>

        {/* Display Options */}
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMortalityCurve}
              onChange={(e) => setShowMortalityCurve(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">Show mortality curve</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFutureGoals}
              onChange={(e) => setShowFutureGoals(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Show future goals
              {futureGoals.filter((g) => g.targetDate && g.status !== 'completed').length > 0 && (
                <span className="ml-1 text-[var(--color-accent-primary)]">
                  ({futureGoals.filter((g) => g.targetDate && g.status !== 'completed').length})
                </span>
              )}
            </span>
          </label>
        </div>

        {/* Layer Filters (always visible) */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-[var(--color-text-muted)]">Layers:</span>
          <button
            onClick={toggleAllLayers}
            className={`badge ${
              visibleLayers.length === ALL_LAYERS.length
                ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                : ''
            }`}
          >
            All
          </button>
          <div className="flex gap-2 flex-wrap">
            {ALL_LAYERS.map((layer) => (
              <button
                key={layer}
                onClick={() => toggleLayer(layer)}
                className={`badge ${LAYER_INFO[layer].badgeClass} ${
                  !visibleLayers.includes(layer) ? 'opacity-40' : ''
                }`}
              >
                {LAYER_INFO[layer].label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters (collapsible) */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-4">
            {/* Source Filters */}
            {availableSources.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-[var(--color-text-muted)]">Sources:</span>
                <button
                  onClick={toggleAllSources}
                  className={`badge ${
                    visibleSources.length === availableSources.length
                      ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                      : ''
                  }`}
                >
                  All
                </button>
                <div className="flex gap-2 flex-wrap">
                  {availableSources.map((source) => (
                    <button
                      key={source}
                      onClick={() => toggleSource(source)}
                      className={`badge ${
                        visibleSources.includes(source)
                          ? 'bg-[var(--color-bg-tertiary)]'
                          : 'opacity-40'
                      }`}
                    >
                      {SOURCE_INFO[source].icon} {SOURCE_INFO[source].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-[var(--color-text-muted)]">Date range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
                <span className="text-[var(--color-text-muted)]">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
                {(dateRange.start || dateRange.end) && (
                  <button
                    onClick={() => setDateRange({ start: '', end: '' })}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Canvas */}
      {events.length > 0 ? (
        <div className="card-elevated h-[500px]">
          {filteredEvents.length > 0 ? (
            <TimelineCanvas
              events={filteredEvents}
              birthYear={birthYear}
              onEventClick={handleEventClick}
              showMortalityCurve={showMortalityCurve}
              showFutureGoals={showFutureGoals}
              futureGoals={futureGoals}
              canvasRef={canvasRef}
              onGoalClick={(goal) => {
                // Navigate to dreamboard with goal selected
                window.location.href = `/dreamboard?goal=${goal.id}`;
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)]">
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <p className="text-lg font-medium mb-2">No events match your filters</p>
              <p className="text-sm mb-4">Try adjusting your filter criteria</p>
              <button onClick={clearFilters} className="btn btn-secondary">
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card-elevated min-h-[500px] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-accent-primary)]/10 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-[var(--color-accent-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Timeline Canvas</h3>
          <p className="text-[var(--color-text-secondary)] text-center max-w-md">
            Your interactive timeline will be rendered here. Import data or add events
            manually to get started.
          </p>
          <a href="/import" className="btn btn-primary mt-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Import Data
          </a>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="card">
          <div className="text-2xl font-bold text-[var(--color-accent-primary)]">
            {stats.total}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">Total Events</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-[var(--color-layer-work)]">
            {stats.work}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            Career Milestones
          </div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-[var(--color-layer-travel)]">
            {stats.travel}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">Places Visited</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-[var(--color-layer-relationships)]">
            {stats.relationships}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">Connections</div>
        </div>
      </div>

      {/* Event Detail Panel */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdate={handleEventUpdate}
          onDelete={handleEventDelete}
        />
      )}
    </div>
  );
}

export default TimelineView;
