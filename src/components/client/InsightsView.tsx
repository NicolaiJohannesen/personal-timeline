'use client';

import { useState, useEffect, useMemo } from 'react';
import { timelineEvents, userProfile, goals } from '@/lib/db';
import type { TimelineEvent, DataLayer, Goal, UserProfile } from '@/types';
import { createAbortController } from '@/lib/utils/asyncCleanup';
import {
  getLifeExpectancy,
  calculateIncomePercentile,
  getExpectedCountriesVisited,
  formatPercentile,
  GLOBAL_LIFE_EXPECTANCY,
  LIFE_EXPECTANCY_BY_COUNTRY,
} from '@/lib/data/globalComparisons';
import { exportTrendDataCSV, exportInsightsReportCSV } from '@/lib/utils/csvExport';

const LAYER_COLORS: Record<DataLayer, string> = {
  economics: '#4ade80',
  education: '#3b82f6',
  work: '#8b5cf6',
  health: '#ef4444',
  relationships: '#ec4899',
  travel: '#f97316',
  media: '#eab308',
};

const LAYER_LABELS: Record<DataLayer, string> = {
  economics: 'Economics',
  education: 'Education',
  work: 'Work',
  health: 'Health',
  relationships: 'Relationships',
  travel: 'Travel',
  media: 'Media',
};

interface Stats {
  totalEvents: number;
  eventsByLayer: Record<DataLayer, number>;
  eventsByYear: Record<number, number>;
  eventsBySource: Record<string, number>;
  oldestEvent: Date | null;
  newestEvent: Date | null;
  yearsOfData: number;
  eventsPerYear: number;
  topEventTypes: { type: string; count: number }[];
  activeGoals: number;
  completedGoals: number;
}

export function InsightsView() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goalsList, setGoalsList] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { isAborted, cleanup } = createAbortController();

    const loadData = async () => {
      try {
        const [eventsData, profileData, goalsData] = await Promise.all([
          timelineEvents.getAll(),
          userProfile.get(),
          goals.getAll(),
        ]);

        // Check if component unmounted during async operation
        if (isAborted()) return;

        setEvents(eventsData);
        setProfile(profileData ?? null);
        setGoalsList(goalsData);
      } catch (error) {
        // Don't update state if unmounted
        if (isAborted()) return;
        console.error('Failed to load insights data:', error);
      } finally {
        if (!isAborted()) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return cleanup;
  }, []);

  const stats = useMemo((): Stats => {
    const eventsByLayer: Record<DataLayer, number> = {
      economics: 0,
      education: 0,
      work: 0,
      health: 0,
      relationships: 0,
      travel: 0,
      media: 0,
    };

    const eventsByYear: Record<number, number> = {};
    const eventsBySource: Record<string, number> = {};
    const eventTypes: Record<string, number> = {};
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;

    for (const event of events) {
      // Count by layer
      eventsByLayer[event.layer] = (eventsByLayer[event.layer] || 0) + 1;

      // Count by year
      const year = new Date(event.startDate).getFullYear();
      eventsByYear[year] = (eventsByYear[year] || 0) + 1;

      // Count by source
      eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;

      // Count by event type
      eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;

      // Track date range
      const eventDate = new Date(event.startDate);
      if (!oldestDate || eventDate < oldestDate) oldestDate = eventDate;
      if (!newestDate || eventDate > newestDate) newestDate = eventDate;
    }

    // Calculate years of data
    const yearsOfData =
      oldestDate && newestDate
        ? newestDate.getFullYear() - oldestDate.getFullYear() + 1
        : 0;

    // Top event types
    const topEventTypes = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Goals stats
    const activeGoals = goalsList.filter(
      (g) => g.status === 'in_progress' || g.status === 'not_started'
    ).length;
    const completedGoals = goalsList.filter((g) => g.status === 'completed').length;

    return {
      totalEvents: events.length,
      eventsByLayer,
      eventsByYear,
      eventsBySource,
      oldestEvent: oldestDate,
      newestEvent: newestDate,
      yearsOfData,
      eventsPerYear: yearsOfData > 0 ? Math.round(events.length / yearsOfData) : 0,
      topEventTypes,
      activeGoals,
      completedGoals,
    };
  }, [events, goalsList]);

  // Calculate age and life progress
  const lifeProgress = useMemo(() => {
    if (!profile?.birthDate) return null;

    const birthDate = new Date(profile.birthDate);
    const now = new Date();
    const ageInMs = now.getTime() - birthDate.getTime();
    const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);
    const lifeExpectancy = profile.lifeExpectancy || 85;
    const percentLived = (ageInYears / lifeExpectancy) * 100;

    return {
      age: Math.floor(ageInYears),
      lifeExpectancy,
      percentLived: Math.min(100, percentLived),
      yearsRemaining: Math.max(0, lifeExpectancy - ageInYears),
      weeksRemaining: Math.max(0, Math.floor((lifeExpectancy - ageInYears) * 52)),
    };
  }, [profile]);

  // Calculate global comparisons
  const globalComparisons = useMemo(() => {
    if (!profile) return null;

    const countryCode = profile.country || 'US';
    const gender = profile.gender as 'male' | 'female' | undefined;
    const age = lifeProgress?.age || 30;

    // Life expectancy comparison
    const countryLifeExpectancy = getLifeExpectancy(countryCode, gender);
    const globalAvgLifeExpectancy = gender
      ? GLOBAL_LIFE_EXPECTANCY[gender]
      : GLOBAL_LIFE_EXPECTANCY.average;
    const lifeExpDiffFromGlobal = countryLifeExpectancy - globalAvgLifeExpectancy;

    // Count unique travel locations from events
    const travelEvents = events.filter((e) => e.layer === 'travel');
    const uniqueLocations = new Set(
      travelEvents
        .map((e) => e.location?.country || e.location?.city)
        .filter(Boolean)
    );
    const countriesVisited = uniqueLocations.size;
    const expectedCountries = getExpectedCountriesVisited(age);
    const travelComparison = countriesVisited - expectedCountries;

    return {
      countryCode,
      countryLifeExpectancy,
      globalAvgLifeExpectancy,
      lifeExpDiffFromGlobal,
      countriesVisited,
      expectedCountries,
      travelComparison,
    };
  }, [profile, events, lifeProgress]);

  // Generate year labels for the chart
  const yearLabels = useMemo(() => {
    const years = Object.keys(stats.eventsByYear).map(Number).sort();
    if (years.length === 0) return [];
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const labels: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      labels.push(y);
    }
    return labels;
  }, [stats.eventsByYear]);

  // Get max events in a year for scaling
  const maxEventsInYear = useMemo(() => {
    const counts = Object.values(stats.eventsByYear);
    return counts.length > 0 ? Math.max(...counts) : 0;
  }, [stats.eventsByYear]);

  if (isLoading) {
    return (
      <div className="fade-in">
        <div className="mb-8">
          <div className="h-9 w-48 bg-[var(--color-bg-secondary)] rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-[var(--color-bg-secondary)] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Insights</h1>
          <p className="text-[var(--color-text-secondary)]">
            Analytics and patterns from your life data
          </p>
        </div>
        {stats.totalEvents > 0 && (
          <button
            onClick={() =>
              exportInsightsReportCSV({
                totalEvents: stats.totalEvents,
                yearsOfData: stats.yearsOfData,
                eventsPerYear: stats.eventsPerYear,
                eventsByLayer: stats.eventsByLayer,
                eventsByYear: stats.eventsByYear,
                eventsBySource: stats.eventsBySource,
              })
            }
            className="btn btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export Report
          </button>
        )}
      </div>

      {/* Life Progress Section */}
      {lifeProgress && (
        <div className="card-elevated mb-8">
          <h3 className="text-xl font-semibold mb-6">Life Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-4xl font-bold text-[var(--color-accent-primary)]">
                {lifeProgress.age}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">Years old</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[var(--color-text-primary)]">
                {lifeProgress.lifeExpectancy}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                Expected lifespan
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[var(--color-accent-secondary)]">
                {Math.round(lifeProgress.yearsRemaining)}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                Years remaining
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[var(--color-text-muted)]">
                {lifeProgress.weeksRemaining.toLocaleString()}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                Weeks remaining
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Life lived</span>
              <span className="text-[var(--color-accent-primary)]">
                {lifeProgress.percentLived.toFixed(1)}%
              </span>
            </div>
            <div className="progress h-3">
              <div
                className="progress-bar"
                style={{ width: `${lifeProgress.percentLived}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Comparisons */}
      {globalComparisons && (
        <div className="card-elevated mb-8">
          <h3 className="text-xl font-semibold mb-6">Global Comparisons</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Life Expectancy Comparison */}
            <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-sm text-[var(--color-text-muted)] mb-2">
                Life Expectancy ({globalComparisons.countryCode})
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {globalComparisons.countryLifeExpectancy.toFixed(1)} years
              </div>
              <div className="mt-2 text-sm">
                <span
                  className={
                    globalComparisons.lifeExpDiffFromGlobal >= 0
                      ? 'text-green-500'
                      : 'text-red-500'
                  }
                >
                  {globalComparisons.lifeExpDiffFromGlobal >= 0 ? '+' : ''}
                  {globalComparisons.lifeExpDiffFromGlobal.toFixed(1)} years
                </span>
                <span className="text-[var(--color-text-muted)]"> vs global avg</span>
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                Global average: {globalComparisons.globalAvgLifeExpectancy.toFixed(1)} years
              </div>
            </div>

            {/* Travel Comparison */}
            <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-sm text-[var(--color-text-muted)] mb-2">
                Destinations Visited
              </div>
              <div className="text-3xl font-bold text-[var(--color-layer-travel)]">
                {globalComparisons.countriesVisited}
              </div>
              <div className="mt-2 text-sm">
                {globalComparisons.travelComparison >= 0 ? (
                  <span className="text-green-500">
                    +{globalComparisons.travelComparison} above average
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">
                    {Math.abs(globalComparisons.travelComparison)} below average
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                Expected for age: ~{globalComparisons.expectedCountries} destinations
              </div>
            </div>

            {/* Data Coverage */}
            <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-sm text-[var(--color-text-muted)] mb-2">
                Data Coverage Score
              </div>
              <div className="text-3xl font-bold text-[var(--color-accent-primary)]">
                {Math.min(100, Math.round((stats.totalEvents / 100) * 10 + (stats.yearsOfData * 5)))}%
              </div>
              <div className="mt-2">
                <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent-primary)] rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((stats.totalEvents / 100) * 10 + (stats.yearsOfData * 5)))}%`,
                    }}
                  />
                </div>
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                Based on event density and time span
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            Data sources: WHO Life Tables 2023, World Bank statistics
          </p>
        </div>
      )}

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-3xl font-bold text-[var(--color-accent-primary)]">
            {stats.totalEvents.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">Total Events</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-[var(--color-text-primary)]">
            {stats.yearsOfData}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">Years of Data</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-[var(--color-accent-secondary)]">
            {stats.eventsPerYear}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            Events per Year
          </div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-[var(--color-layer-travel)]">
            {Object.keys(stats.eventsBySource).length}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">Data Sources</div>
        </div>
      </div>

      {/* Events by Layer */}
      <div className="card-elevated mb-8">
        <h3 className="text-xl font-semibold mb-6">Events by Layer</h3>
        {stats.totalEvents > 0 ? (
          <div className="space-y-4">
            {(Object.keys(LAYER_LABELS) as DataLayer[]).map((layer) => {
              const count = stats.eventsByLayer[layer];
              const percentage =
                stats.totalEvents > 0 ? (count / stats.totalEvents) * 100 : 0;
              return (
                <div key={layer}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: LAYER_COLORS[layer] }}>
                      {LAYER_LABELS[layer]}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: LAYER_COLORS[layer],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            No events to analyze. Import data to see layer distribution.
          </div>
        )}
      </div>

      {/* Events Timeline Chart */}
      <div className="card-elevated mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Events Over Time</h3>
          {yearLabels.length > 0 && (
            <button
              onClick={() => exportTrendDataCSV(stats.eventsByYear)}
              className="btn btn-secondary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>
          )}
        </div>
        {yearLabels.length > 0 ? (
          <div>
            <div className="flex items-end gap-1 h-40 mb-2">
              {yearLabels.map((year) => {
                const count = stats.eventsByYear[year] || 0;
                const heightPercent =
                  maxEventsInYear > 0 ? (count / maxEventsInYear) * 100 : 0;
                return (
                  <div
                    key={year}
                    className="flex-1 flex flex-col items-center justify-end group"
                  >
                    <div className="relative w-full">
                      <div
                        className="w-full bg-[var(--color-accent-primary)] rounded-t transition-all duration-300 hover:bg-[var(--color-accent-secondary)]"
                        style={{ height: `${Math.max(heightPercent, 2)}%`, minHeight: '4px' }}
                        title={`${year}: ${count} events`}
                      />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs bg-[var(--color-bg-elevated)] px-1 rounded transition-opacity">
                        {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 text-xs text-[var(--color-text-muted)] overflow-x-auto">
              {yearLabels.map((year, i) => (
                <div
                  key={year}
                  className="flex-1 text-center"
                  style={{ minWidth: '30px' }}
                >
                  {i % Math.ceil(yearLabels.length / 10) === 0 ? year : ''}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            No events to visualize. Import data to see your timeline chart.
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top Event Types */}
        <div className="card-elevated">
          <h3 className="text-xl font-semibold mb-6">Top Event Types</h3>
          {stats.topEventTypes.length > 0 ? (
            <div className="space-y-3">
              {stats.topEventTypes.map((item, index) => (
                <div
                  key={item.type}
                  className="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-[var(--color-text-muted)]">
                      #{index + 1}
                    </span>
                    <span className="capitalize">{item.type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-semibold text-[var(--color-accent-primary)]">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              No events yet
            </div>
          )}
        </div>

        {/* Data Sources */}
        <div className="card-elevated">
          <h3 className="text-xl font-semibold mb-6">Data Sources</h3>
          {Object.keys(stats.eventsBySource).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.eventsBySource)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg"
                  >
                    <span className="capitalize">{source}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{count}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        ({((count / stats.totalEvents) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              No data sources yet. Import data to see source distribution.
            </div>
          )}
        </div>
      </div>

      {/* Activity Heat Map */}
      {stats.totalEvents > 0 && (
        <ActivityHeatMap events={events} />
      )}

      {/* Goals Summary */}
      <div className="card-elevated">
        <h3 className="text-xl font-semibold mb-6">Goals Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-[var(--color-bg-secondary)] rounded-lg">
            <div className="text-3xl font-bold text-[var(--color-accent-primary)]">
              {stats.activeGoals}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">Active Goals</div>
          </div>
          <div className="text-center p-4 bg-[var(--color-bg-secondary)] rounded-lg">
            <div className="text-3xl font-bold text-green-500">
              {stats.completedGoals}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              Completed Goals
            </div>
          </div>
          <div className="text-center p-4 bg-[var(--color-bg-secondary)] rounded-lg">
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {goalsList.length}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">Total Goals</div>
          </div>
        </div>
        {goalsList.length === 0 && (
          <div className="text-center mt-6">
            <a href="/dreamboard" className="btn btn-primary">
              Create Your First Goal
            </a>
          </div>
        )}
      </div>

      {/* Date Range Info */}
      {stats.oldestEvent && stats.newestEvent && (
        <div className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
          Data spans from{' '}
          <span className="text-[var(--color-text-secondary)]">
            {stats.oldestEvent.toLocaleDateString()}
          </span>{' '}
          to{' '}
          <span className="text-[var(--color-text-secondary)]">
            {stats.newestEvent.toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}

// Activity Heat Map Component
function ActivityHeatMap({ events }: { events: TimelineEvent[] }) {
  // Calculate activity by month
  const monthlyActivity = useMemo(() => {
    const activity: Record<string, Record<number, number>> = {}; // year -> month -> count

    events.forEach(event => {
      const date = new Date(event.startDate);
      const year = date.getFullYear().toString();
      const month = date.getMonth();

      if (!activity[year]) {
        activity[year] = {};
      }
      activity[year][month] = (activity[year][month] || 0) + 1;
    });

    return activity;
  }, [events]);

  const years = Object.keys(monthlyActivity).sort();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Find max for scaling
  const maxCount = useMemo(() => {
    let max = 0;
    Object.values(monthlyActivity).forEach(yearData => {
      Object.values(yearData).forEach(count => {
        if (count > max) max = count;
      });
    });
    return max;
  }, [monthlyActivity]);

  const getHeatColor = (count: number) => {
    if (count === 0) return 'var(--color-bg-secondary)';
    const intensity = Math.min(count / maxCount, 1);
    const alpha = 0.2 + (intensity * 0.8);
    return `rgba(245, 166, 35, ${alpha})`;
  };

  if (years.length === 0) return null;

  return (
    <div className="card-elevated mb-8">
      <h3 className="text-xl font-semibold mb-6">Activity Heat Map</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Month labels */}
          <div className="flex mb-2">
            <div className="w-16 flex-shrink-0" />
            {months.map(month => (
              <div key={month} className="flex-1 text-center text-xs text-[var(--color-text-muted)]">
                {month}
              </div>
            ))}
          </div>

          {/* Year rows */}
          {years.map(year => (
            <div key={year} className="flex mb-1">
              <div className="w-16 flex-shrink-0 text-sm text-[var(--color-text-muted)] flex items-center">
                {year}
              </div>
              <div className="flex-1 flex gap-1">
                {months.map((_, monthIndex) => {
                  const count = monthlyActivity[year]?.[monthIndex] || 0;
                  return (
                    <div
                      key={monthIndex}
                      className="flex-1 h-8 rounded transition-all hover:scale-110"
                      style={{ backgroundColor: getHeatColor(count) }}
                      title={`${months[monthIndex]} ${year}: ${count} event${count !== 1 ? 's' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-xs text-[var(--color-text-muted)]">Less</span>
            {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded"
                style={{ backgroundColor: `rgba(245, 166, 35, ${0.2 + intensity * 0.8})` }}
              />
            ))}
            <span className="text-xs text-[var(--color-text-muted)]">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsightsView;
