'use client';

import { useState, useMemo } from 'react';
import { assessments } from '@/lib/db';
import type { AssessmentResult } from '@/types';

interface CoreValuesAssessmentProps {
  onComplete?: (result: AssessmentResult) => void;
  onCancel?: () => void;
}

interface Value {
  id: string;
  name: string;
  description: string;
  category: 'personal' | 'social' | 'professional' | 'spiritual';
}

const VALUES: Value[] = [
  // Personal Values
  { id: 'achievement', name: 'Achievement', description: 'Accomplishing goals and being successful', category: 'personal' },
  { id: 'adventure', name: 'Adventure', description: 'New experiences and taking risks', category: 'personal' },
  { id: 'authenticity', name: 'Authenticity', description: 'Being true to yourself', category: 'personal' },
  { id: 'creativity', name: 'Creativity', description: 'Original thinking and artistic expression', category: 'personal' },
  { id: 'freedom', name: 'Freedom', description: 'Independence and autonomy', category: 'personal' },
  { id: 'growth', name: 'Growth', description: 'Personal development and learning', category: 'personal' },
  { id: 'happiness', name: 'Happiness', description: 'Feeling joy and contentment', category: 'personal' },
  { id: 'health', name: 'Health', description: 'Physical and mental well-being', category: 'personal' },
  { id: 'peace', name: 'Peace', description: 'Inner calm and tranquility', category: 'personal' },
  { id: 'security', name: 'Security', description: 'Safety and stability', category: 'personal' },

  // Social Values
  { id: 'belonging', name: 'Belonging', description: 'Being part of a community', category: 'social' },
  { id: 'compassion', name: 'Compassion', description: 'Caring for others\' well-being', category: 'social' },
  { id: 'fairness', name: 'Fairness', description: 'Justice and equality for all', category: 'social' },
  { id: 'family', name: 'Family', description: 'Close relationships with family', category: 'social' },
  { id: 'friendship', name: 'Friendship', description: 'Deep connections with friends', category: 'social' },
  { id: 'love', name: 'Love', description: 'Giving and receiving affection', category: 'social' },
  { id: 'respect', name: 'Respect', description: 'Being valued and valuing others', category: 'social' },
  { id: 'service', name: 'Service', description: 'Contributing to others\' lives', category: 'social' },

  // Professional Values
  { id: 'excellence', name: 'Excellence', description: 'High quality in everything you do', category: 'professional' },
  { id: 'influence', name: 'Influence', description: 'Having impact on others', category: 'professional' },
  { id: 'integrity', name: 'Integrity', description: 'Honesty and strong moral principles', category: 'professional' },
  { id: 'leadership', name: 'Leadership', description: 'Guiding and inspiring others', category: 'professional' },
  { id: 'recognition', name: 'Recognition', description: 'Being acknowledged for achievements', category: 'professional' },
  { id: 'responsibility', name: 'Responsibility', description: 'Being accountable and dependable', category: 'professional' },
  { id: 'success', name: 'Success', description: 'Achieving professional goals', category: 'professional' },
  { id: 'wealth', name: 'Wealth', description: 'Financial abundance', category: 'professional' },

  // Spiritual/Philosophical Values
  { id: 'balance', name: 'Balance', description: 'Harmony in all areas of life', category: 'spiritual' },
  { id: 'gratitude', name: 'Gratitude', description: 'Appreciation for what you have', category: 'spiritual' },
  { id: 'purpose', name: 'Purpose', description: 'Having meaningful direction in life', category: 'spiritual' },
  { id: 'wisdom', name: 'Wisdom', description: 'Deep understanding and insight', category: 'spiritual' },
];

const CATEGORY_LABELS: Record<string, string> = {
  personal: 'Personal Growth',
  social: 'Relationships & Community',
  professional: 'Career & Achievement',
  spiritual: 'Meaning & Purpose',
};

const CATEGORY_COLORS: Record<string, string> = {
  personal: 'var(--color-layer-health)',
  social: 'var(--color-layer-relationships)',
  professional: 'var(--color-layer-work)',
  spiritual: 'var(--color-accent-primary)',
};

type RatingLevel = 1 | 2 | 3 | 4 | 5;

const RATING_LABELS: Record<RatingLevel, string> = {
  1: 'Not Important',
  2: 'Slightly Important',
  3: 'Moderately Important',
  4: 'Very Important',
  5: 'Essential',
};

export function CoreValuesAssessment({ onComplete, onCancel }: CoreValuesAssessmentProps) {
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const startTime = useState(() => Date.now())[0];

  const valuesPerPage = 10;
  const totalPages = Math.ceil(VALUES.length / valuesPerPage);
  const currentValues = VALUES.slice(currentPage * valuesPerPage, (currentPage + 1) * valuesPerPage);
  const progress = ((Object.keys(ratings).length / VALUES.length) * 100);

  // Calculate results
  const results = useMemo(() => {
    if (Object.keys(ratings).length < VALUES.length) return null;

    // Sort values by rating
    const sortedValues = VALUES.map((v) => ({
      ...v,
      rating: ratings[v.id] || 0,
    })).sort((a, b) => b.rating - a.rating);

    // Get top 5 core values
    const topValues = sortedValues.slice(0, 5);

    // Get bottom 5 (least important)
    const bottomValues = sortedValues.slice(-5).reverse();

    // Category breakdown
    const categoryScores: Record<string, { total: number; count: number; avg: number }> = {};
    VALUES.forEach((v) => {
      if (!categoryScores[v.category]) {
        categoryScores[v.category] = { total: 0, count: 0, avg: 0 };
      }
      categoryScores[v.category].total += ratings[v.id] || 0;
      categoryScores[v.category].count++;
    });

    Object.keys(categoryScores).forEach((cat) => {
      categoryScores[cat].avg = Math.round((categoryScores[cat].total / categoryScores[cat].count) * 10) / 10;
    });

    // Find dominant category
    const dominantCategory = Object.entries(categoryScores).sort((a, b) => b[1].avg - a[1].avg)[0][0];

    return {
      topValues,
      bottomValues,
      categoryScores,
      dominantCategory,
      totalRated: Object.keys(ratings).length,
    };
  }, [ratings]);

  const handleRating = (valueId: string, rating: RatingLevel) => {
    setRatings((prev) => ({ ...prev, [valueId]: rating }));
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1);
    } else if (Object.keys(ratings).length === VALUES.length) {
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const canProceed = currentValues.every((v) => ratings[v.id] !== undefined);

  const handleSave = async () => {
    if (!results) return;

    setIsSaving(true);
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Create scores object with top values and category averages
      const scores: Record<string, number | string> = {
        dominantCategory: results.dominantCategory,
      };

      // Add top 5 values
      results.topValues.forEach((v, i) => {
        scores[`top${i + 1}`] = v.name;
        scores[`top${i + 1}_rating`] = v.rating;
      });

      // Add category averages
      Object.entries(results.categoryScores).forEach(([cat, data]) => {
        scores[`${cat}_avg`] = data.avg;
      });

      const result: AssessmentResult = {
        id: crypto.randomUUID(),
        userId: 'default-user',
        assessmentType: 'values',
        completedAt: new Date(),
        duration,
        scores,
      };

      await assessments.add(result);
      onComplete?.(result);
    } catch (error) {
      console.error('Failed to save values results:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Results view
  if (showResults && results) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Core Values</h2>
          <button
            onClick={() => {
              setShowResults(false);
              setCurrentPage(0);
            }}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Review Ratings
          </button>
        </div>

        {/* Top 5 Values */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Your Top 5 Core Values</h3>
          <div className="space-y-3">
            {results.topValues.map((value, index) => (
              <div
                key={value.id}
                className="flex items-center gap-4 p-4 rounded-lg"
                style={{ backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[value.category]} 10%, transparent)` }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{
                    backgroundColor: CATEGORY_COLORS[value.category],
                    color: 'var(--color-bg-primary)',
                  }}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{value.name}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">{value.description}</div>
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {CATEGORY_LABELS[value.category]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dominant Category */}
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-6 mb-6 text-center">
          <div className="text-sm text-[var(--color-text-muted)] mb-2">Your Dominant Value Category</div>
          <div
            className="text-2xl font-bold"
            style={{ color: CATEGORY_COLORS[results.dominantCategory] }}
          >
            {CATEGORY_LABELS[results.dominantCategory]}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Category Importance</h3>
          <div className="space-y-3">
            {Object.entries(results.categoryScores)
              .sort((a, b) => b[1].avg - a[1].avg)
              .map(([category, data]) => (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{CATEGORY_LABELS[category]}</span>
                    <span className="font-medium">{data.avg}/5</span>
                  </div>
                  <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(data.avg / 5) * 100}%`,
                        backgroundColor: CATEGORY_COLORS[category],
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Values You Deprioritize */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Values You Deprioritize</h3>
          <div className="flex flex-wrap gap-2">
            {results.bottomValues.map((value) => (
              <span
                key={value.id}
                className="px-3 py-1 bg-[var(--color-bg-tertiary)] rounded-full text-sm text-[var(--color-text-secondary)]"
              >
                {value.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            These values ranked lowest in importance to you. This doesn&apos;t mean they&apos;re unimportant—just less central to your identity.
          </p>
        </div>

        {/* Insight */}
        <div className="bg-[var(--color-accent-primary)]/10 border border-[var(--color-accent-primary)]/20 rounded-lg p-4 mb-6">
          <div className="font-medium text-[var(--color-accent-primary)] mb-2">What This Means</div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Your core values guide your decisions, relationships, and life satisfaction. When your daily actions align with these values, you&apos;ll feel more fulfilled. Consider how your goals and current lifestyle reflect these priorities.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn btn-secondary flex-1">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Results'}
          </button>
        </div>
      </div>
    );
  }

  // Rating view
  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Core Values Assessment</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Rate how important each value is to you
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--color-text-muted)]">
            Page {currentPage + 1} of {totalPages}
          </span>
          <span className="text-[var(--color-text-muted)]">
            {Object.keys(ratings).length} of {VALUES.length} rated
          </span>
        </div>
        <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent-primary)] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Rating Scale Legend */}
      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-4 px-2">
        <span>Not Important</span>
        <span>Essential</span>
      </div>

      {/* Values to Rate */}
      <div className="space-y-4 mb-6">
        {currentValues.map((value) => (
          <div key={value.id} className="border border-[var(--color-border)] rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-medium">{value.name}</div>
                <div className="text-sm text-[var(--color-text-secondary)]">{value.description}</div>
              </div>
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[value.category]} 15%, transparent)`,
                  color: CATEGORY_COLORS[value.category],
                }}
              >
                {CATEGORY_LABELS[value.category]}
              </span>
            </div>

            {/* Rating Buttons */}
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as RatingLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => handleRating(value.id, level)}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-all ${
                    ratings[value.id] === level
                      ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                      : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                  title={RATING_LABELS[level]}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 0}
          className="btn btn-secondary"
        >
          Previous
        </button>
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="btn btn-primary ml-auto"
        >
          {currentPage < totalPages - 1 ? 'Next' : 'See Results'}
        </button>
      </div>
    </div>
  );
}
