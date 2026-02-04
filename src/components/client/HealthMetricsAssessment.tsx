'use client';

import { useState, useEffect, useMemo } from 'react';
import { assessments, timelineEvents } from '@/lib/db';
import type { AssessmentResult, TimelineEvent } from '@/types';
import { sanitizeString } from '@/lib/import/validation';

interface HealthEntry {
  date: string;
  weight?: number;
  systolic?: number;
  diastolic?: number;
  sleep?: number;
  exercise?: number;
  mood?: number;
  notes?: string;
}

interface HealthMetricsProps {
  onComplete: (result: AssessmentResult) => void;
  onCancel: () => void;
}

const MOOD_LABELS = ['Very Low', 'Low', 'Below Average', 'Neutral', 'Above Average', 'Good', 'Very Good', 'Great', 'Excellent', 'Outstanding'];

export function HealthMetricsAssessment({ onComplete, onCancel }: HealthMetricsProps) {
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<HealthEntry>({
    date: new Date().toISOString().split('T')[0],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');

  // Load previous health entries from timeline events
  useEffect(() => {
    const loadHealthData = async () => {
      try {
        const events = await timelineEvents.getAll();
        const healthEvents = events
          .filter((e) => e.layer === 'health' && e.eventType === 'health_metric')
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

        const loadedEntries: HealthEntry[] = healthEvents.map((event) => ({
          date: new Date(event.startDate).toISOString().split('T')[0],
          weight: (event.metadata?.weight as number) || undefined,
          systolic: (event.metadata?.systolic as number) || undefined,
          diastolic: (event.metadata?.diastolic as number) || undefined,
          sleep: (event.metadata?.sleep as number) || undefined,
          exercise: (event.metadata?.exercise as number) || undefined,
          mood: (event.metadata?.mood as number) || undefined,
          notes: (event.metadata?.notes as string) || undefined,
        }));

        setEntries(loadedEntries);
      } catch (error) {
        console.error('Failed to load health data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHealthData();
  }, []);

  // Calculate trends
  const trends = useMemo(() => {
    if (entries.length < 2) return null;

    const recent = entries.slice(0, 7);
    const avgWeight = recent.filter((e) => e.weight).reduce((sum, e) => sum + (e.weight || 0), 0) / (recent.filter((e) => e.weight).length || 1);
    const avgSleep = recent.filter((e) => e.sleep).reduce((sum, e) => sum + (e.sleep || 0), 0) / (recent.filter((e) => e.sleep).length || 1);
    const avgExercise = recent.filter((e) => e.exercise).reduce((sum, e) => sum + (e.exercise || 0), 0) / (recent.filter((e) => e.exercise).length || 1);
    const avgMood = recent.filter((e) => e.mood).reduce((sum, e) => sum + (e.mood || 0), 0) / (recent.filter((e) => e.mood).length || 1);

    return {
      avgWeight: avgWeight > 0 ? avgWeight.toFixed(1) : null,
      avgSleep: avgSleep > 0 ? avgSleep.toFixed(1) : null,
      avgExercise: avgExercise > 0 ? Math.round(avgExercise) : null,
      avgMood: avgMood > 0 ? avgMood.toFixed(1) : null,
    };
  }, [entries]);

  const handleInputChange = (field: keyof HealthEntry, value: string | number) => {
    setCurrentEntry((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveEntry = async () => {
    // Validate that at least one metric is filled
    const hasData = currentEntry.weight || currentEntry.systolic || currentEntry.sleep || currentEntry.exercise || currentEntry.mood;
    if (!hasData) {
      alert('Please enter at least one health metric');
      return;
    }

    setIsSaving(true);
    try {
      // Sanitize notes
      const sanitizedNotes = currentEntry.notes ? sanitizeString(currentEntry.notes) : undefined;

      // Create timeline event for this health entry
      const event: TimelineEvent = {
        id: crypto.randomUUID(),
        userId: 'default',
        title: `Health Check-in`,
        description: buildDescription(currentEntry),
        startDate: new Date(currentEntry.date),
        layer: 'health',
        eventType: 'health_metric',
        source: 'manual',
        metadata: {
          weight: currentEntry.weight,
          systolic: currentEntry.systolic,
          diastolic: currentEntry.diastolic,
          sleep: currentEntry.sleep,
          exercise: currentEntry.exercise,
          mood: currentEntry.mood,
          notes: sanitizedNotes,
          weightUnit,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await timelineEvents.add(event);

      // Create assessment result
      const result: AssessmentResult = {
        id: crypto.randomUUID(),
        userId: 'default',
        assessmentType: 'values', // Using 'values' as a workaround since there's no 'health' type
        completedAt: new Date(),
        scores: {
          type: 'health_metrics',
          date: currentEntry.date,
          weight: currentEntry.weight || '',
          bloodPressure: currentEntry.systolic && currentEntry.diastolic ? `${currentEntry.systolic}/${currentEntry.diastolic}` : '',
          sleep: currentEntry.sleep || '',
          exercise: currentEntry.exercise || '',
          mood: currentEntry.mood || '',
        },
        duration: 60, // Estimated
      };

      // Add to local entries
      setEntries((prev) => [currentEntry, ...prev]);

      // Reset form
      setCurrentEntry({
        date: new Date().toISOString().split('T')[0],
      });

      onComplete(result);
    } catch (error) {
      console.error('Failed to save health entry:', error);
      alert('Failed to save health entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildDescription = (entry: HealthEntry): string => {
    const parts: string[] = [];
    if (entry.weight) parts.push(`Weight: ${entry.weight} ${weightUnit}`);
    if (entry.systolic && entry.diastolic) parts.push(`BP: ${entry.systolic}/${entry.diastolic} mmHg`);
    if (entry.sleep) parts.push(`Sleep: ${entry.sleep}h`);
    if (entry.exercise) parts.push(`Exercise: ${entry.exercise} min`);
    if (entry.mood) parts.push(`Mood: ${entry.mood}/10`);
    return parts.join(' | ');
  };

  if (isLoading) {
    return (
      <div className="card-elevated p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Health Metrics</h2>
          <p className="text-[var(--color-text-secondary)]">Track your daily health and wellness</p>
        </div>
        <button onClick={onCancel} className="btn btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Quick Stats */}
      {trends && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {trends.avgWeight && (
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg text-center">
              <div className="text-xl font-bold text-[var(--color-layer-health)]">
                {trends.avgWeight} {weightUnit}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Avg Weight (7d)</div>
            </div>
          )}
          {trends.avgSleep && (
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg text-center">
              <div className="text-xl font-bold text-[var(--color-layer-education)]">{trends.avgSleep}h</div>
              <div className="text-xs text-[var(--color-text-muted)]">Avg Sleep (7d)</div>
            </div>
          )}
          {trends.avgExercise && (
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg text-center">
              <div className="text-xl font-bold text-[var(--color-layer-work)]">{trends.avgExercise} min</div>
              <div className="text-xs text-[var(--color-text-muted)]">Avg Exercise (7d)</div>
            </div>
          )}
          {trends.avgMood && (
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg text-center">
              <div className="text-xl font-bold text-[var(--color-accent-primary)]">{trends.avgMood}/10</div>
              <div className="text-xs text-[var(--color-text-muted)]">Avg Mood (7d)</div>
            </div>
          )}
        </div>
      )}

      {/* Entry Form */}
      <div className="space-y-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium mb-2">Date</label>
          <input
            type="date"
            value={currentEntry.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            className="w-full px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
          />
        </div>

        {/* Weight */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Weight
            <button
              type="button"
              onClick={() => setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg')}
              className="ml-2 text-xs text-[var(--color-accent-primary)] hover:underline"
            >
              ({weightUnit} - click to switch)
            </button>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="500"
            placeholder={`Enter weight in ${weightUnit}`}
            value={currentEntry.weight || ''}
            onChange={(e) => handleInputChange('weight', e.target.value ? parseFloat(e.target.value) : undefined)}
            className="w-full px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
          />
        </div>

        {/* Blood Pressure */}
        <div>
          <label className="block text-sm font-medium mb-2">Blood Pressure (mmHg)</label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min="60"
              max="250"
              placeholder="Systolic"
              value={currentEntry.systolic || ''}
              onChange={(e) => handleInputChange('systolic', e.target.value ? parseInt(e.target.value) : undefined)}
              className="flex-1 px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
            />
            <span className="text-[var(--color-text-muted)]">/</span>
            <input
              type="number"
              min="40"
              max="150"
              placeholder="Diastolic"
              value={currentEntry.diastolic || ''}
              onChange={(e) => handleInputChange('diastolic', e.target.value ? parseInt(e.target.value) : undefined)}
              className="flex-1 px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
            />
          </div>
        </div>

        {/* Sleep */}
        <div>
          <label className="block text-sm font-medium mb-2">Sleep (hours)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder="Hours of sleep"
            value={currentEntry.sleep || ''}
            onChange={(e) => handleInputChange('sleep', e.target.value ? parseFloat(e.target.value) : undefined)}
            className="w-full px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
          />
        </div>

        {/* Exercise */}
        <div>
          <label className="block text-sm font-medium mb-2">Exercise (minutes)</label>
          <input
            type="number"
            min="0"
            max="1440"
            placeholder="Minutes of exercise"
            value={currentEntry.exercise || ''}
            onChange={(e) => handleInputChange('exercise', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
          />
        </div>

        {/* Mood */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Mood (1-10){currentEntry.mood && `: ${MOOD_LABELS[currentEntry.mood - 1]}`}
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleInputChange('mood', value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentEntry.mood === value
                    ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">Notes (optional)</label>
          <textarea
            placeholder="Any additional notes..."
            value={currentEntry.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleSaveEntry}
            disabled={isSaving}
            className="flex-1 btn btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Entry'}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn btn-secondary"
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>
      </div>

      {/* History */}
      {showHistory && entries.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4">Recent Entries</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {entries.slice(0, 10).map((entry, index) => (
              <div
                key={index}
                className="p-3 bg-[var(--color-bg-secondary)] rounded-lg text-sm"
              >
                <div className="font-medium mb-1">{new Date(entry.date).toLocaleDateString()}</div>
                <div className="text-[var(--color-text-secondary)]">{buildDescription(entry)}</div>
                {entry.notes && (
                  <div className="text-[var(--color-text-muted)] mt-1 italic">"{entry.notes}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default HealthMetricsAssessment;
