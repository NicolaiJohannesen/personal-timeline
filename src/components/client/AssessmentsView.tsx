'use client';

import { useState, useEffect } from 'react';
import { BigFiveAssessment } from './BigFiveAssessment';
import { FIRECalculator } from './FIRECalculator';
import { RiskToleranceAssessment } from './RiskToleranceAssessment';
import { CoreValuesAssessment } from './CoreValuesAssessment';
import { CognitiveAssessment } from './CognitiveAssessment';
import { HealthMetricsAssessment } from './HealthMetricsAssessment';
import { MBTIAssessment } from './MBTIAssessment';
import { assessments } from '@/lib/db';
import type { AssessmentResult, AssessmentType } from '@/types';

type ActiveAssessment = 'big5' | 'mbti' | 'cognitive' | 'risk' | 'values' | 'fire' | 'health' | null;

interface AssessmentCard {
  id: ActiveAssessment;
  title: string;
  duration: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  available: boolean;
}

const ASSESSMENT_CARDS: AssessmentCard[] = [
  {
    id: 'big5',
    title: 'Big Five Personality',
    duration: '~15 minutes',
    description: 'Measure your openness, conscientiousness, extraversion, agreeableness, and neuroticism.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    colorClass: 'var(--color-layer-work)',
    available: true,
  },
  {
    id: 'mbti',
    title: 'MBTI Personality Type',
    duration: '~10 minutes',
    description: 'Discover your 4-letter personality type based on how you perceive the world and make decisions.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    colorClass: 'var(--color-layer-relationships)',
    available: true,
  },
  {
    id: 'cognitive',
    title: 'Cognitive Assessment',
    duration: '~20 minutes',
    description: 'Test pattern recognition, verbal reasoning, and numerical ability.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    colorClass: 'var(--color-layer-education)',
    available: true,
  },
  {
    id: 'risk',
    title: 'Risk Tolerance',
    duration: '~10 minutes',
    description: 'Understand your financial risk profile for better investment planning.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    colorClass: 'var(--color-layer-economics)',
    available: true,
  },
  {
    id: 'values',
    title: 'Core Values',
    duration: '~20 minutes',
    description: 'Identify your core values to guide life decisions and goal-setting.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    colorClass: 'var(--color-accent-primary)',
    available: true,
  },
  {
    id: 'fire',
    title: 'FIRE Calculator',
    duration: '~5 minutes',
    description: 'Calculate your path to Financial Independence and Early Retirement.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
      </svg>
    ),
    colorClass: 'var(--color-layer-economics)',
    available: true,
  },
  {
    id: 'health',
    title: 'Health Metrics',
    duration: '~2 minutes',
    description: 'Track weight, blood pressure, sleep, exercise, and mood daily.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    colorClass: 'var(--color-layer-health)',
    available: true,
  },
];

const ASSESSMENT_TYPE_MAP: Record<string, AssessmentType> = {
  big5: 'personality_big5',
  mbti: 'personality_mbti',
  cognitive: 'iq',
  risk: 'risk_tolerance',
  values: 'values',
  fire: 'fire_projection',
};

const TRAIT_LABELS: Record<string, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  neuroticism: 'Neuroticism',
};

export function AssessmentsView() {
  const [activeAssessment, setActiveAssessment] = useState<ActiveAssessment>(null);
  const [previousResults, setPreviousResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const results = await assessments.getAll();
      // Sort by completion date, newest first
      results.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setPreviousResults(results);
    } catch (error) {
      console.error('Failed to load assessment results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentComplete = (result: AssessmentResult) => {
    setPreviousResults((prev) => [result, ...prev]);
  };

  const handleStartAssessment = (id: ActiveAssessment) => {
    if (id && ASSESSMENT_CARDS.find((c) => c.id === id)?.available) {
      setActiveAssessment(id);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const getAssessmentTitle = (type: AssessmentType): string => {
    switch (type) {
      case 'personality_big5':
        return 'Big Five Personality';
      case 'personality_mbti':
        return 'MBTI Personality Type';
      case 'iq':
        return 'Cognitive Assessment';
      case 'risk_tolerance':
        return 'Risk Tolerance';
      case 'values':
        return 'Core Values';
      case 'fire_projection':
        return 'FIRE Calculator';
      default:
        return type;
    }
  };

  // Show active assessment
  if (activeAssessment === 'big5') {
    return (
      <div className="max-w-2xl mx-auto">
        <BigFiveAssessment
          onComplete={handleAssessmentComplete}
          onCancel={() => setActiveAssessment(null)}
        />
      </div>
    );
  }

  if (activeAssessment === 'mbti') {
    return (
      <div className="max-w-2xl mx-auto">
        <MBTIAssessment
          onComplete={(result) => {
            handleAssessmentComplete(result);
            setActiveAssessment(null);
          }}
          onCancel={() => setActiveAssessment(null)}
        />
      </div>
    );
  }

  if (activeAssessment === 'fire') {
    return (
      <div className="max-w-2xl mx-auto">
        <FIRECalculator
          onComplete={(result) => {
            handleAssessmentComplete(result);
            setActiveAssessment(null);
          }}
          onCancel={() => setActiveAssessment(null)}
        />
      </div>
    );
  }

  if (activeAssessment === 'risk') {
    return (
      <div className="max-w-2xl mx-auto">
        <RiskToleranceAssessment
          onComplete={(result) => {
            handleAssessmentComplete(result);
            setActiveAssessment(null);
          }}
          onCancel={() => setActiveAssessment(null)}
        />
      </div>
    );
  }

  if (activeAssessment === 'values') {
    return (
      <div className="max-w-2xl mx-auto">
        <CoreValuesAssessment
          onComplete={(result) => {
            handleAssessmentComplete(result);
            setActiveAssessment(null);
          }}
          onCancel={() => setActiveAssessment(null)}
        />
      </div>
    );
  }

  if (activeAssessment === 'cognitive') {
    return (
      <div className="max-w-2xl mx-auto">
        <CognitiveAssessment
          onComplete={(result) => {
            handleAssessmentComplete(result);
            setActiveAssessment(null);
          }}
          onCancel={() => setActiveAssessment(null)}
        />
      </div>
    );
  }

  if (activeAssessment === 'health') {
    return (
      <div className="max-w-2xl mx-auto">
        <HealthMetricsAssessment
          onComplete={(result) => {
            handleAssessmentComplete(result);
            setActiveAssessment(null);
          }}
          onCancel={() => setActiveAssessment(null)}
        />
      </div>
    );
  }

  // Show assessment list
  return (
    <div className="fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Assessments</h1>
        <p className="text-[var(--color-text-secondary)]">
          Understand yourself better with standardized assessments
        </p>
      </div>

      {/* Assessment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ASSESSMENT_CARDS.map((card) => (
          <div key={card.id} className="card">
            <div className="flex items-start gap-4 mb-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${card.colorClass} 10%, transparent)` }}
              >
                <div style={{ color: card.colorClass }}>{card.icon}</div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{card.duration}</p>
              </div>
            </div>
            <p className="text-[var(--color-text-secondary)] mb-4">{card.description}</p>
            <button
              onClick={() => handleStartAssessment(card.id)}
              disabled={!card.available}
              className={`w-full ${card.available ? 'btn btn-secondary' : 'btn btn-secondary opacity-50 cursor-not-allowed'}`}
            >
              {card.available ? 'Start Assessment' : 'Coming Soon'}
            </button>
          </div>
        ))}
      </div>

      {/* Previous Results */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Your Results</h2>

        {loading ? (
          <div className="card">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/4" />
              <div className="h-20 bg-[var(--color-bg-tertiary)] rounded" />
            </div>
          </div>
        ) : previousResults.length === 0 ? (
          <div className="card">
            <div className="flex items-center justify-center py-8 text-[var(--color-text-muted)]">
              <p>Complete an assessment to see your results here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {previousResults.map((result) => (
              <div key={result.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{getAssessmentTitle(result.assessmentType)}</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Completed {formatDate(result.completedAt)} ({formatDuration(result.duration)})
                    </p>
                  </div>
                </div>

                {result.assessmentType === 'personality_big5' && (
                  <div className="grid grid-cols-5 gap-4">
                    {Object.entries(result.scores)
                      .filter(([key]) => !key.includes('_raw'))
                      .map(([trait, score]) => (
                        <div key={trait} className="text-center">
                          <div className="text-2xl font-bold text-[var(--color-accent-primary)]">
                            {score}%
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] capitalize">
                            {TRAIT_LABELS[trait] || trait}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {result.assessmentType === 'fire_projection' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[var(--color-accent-primary)]">
                        ${Number(result.scores.fireNumber).toLocaleString()}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">FIRE Number</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[var(--color-layer-economics)]">
                        {result.scores.yearsToFIRE === Infinity ? '∞' : result.scores.yearsToFIRE}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Years to FIRE</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {result.scores.currentSavingsRate}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Savings Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {result.scores.progressPercentage}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Progress</div>
                    </div>
                  </div>
                )}

                {result.assessmentType === 'risk_tolerance' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center md:col-span-2">
                      <div className="text-2xl font-bold text-[var(--color-layer-economics)] capitalize">
                        {String(result.scores.profile).replace('_', ' ')}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Risk Profile</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[var(--color-accent-primary)]">
                        {result.scores.percentage}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Risk Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {result.scores.volatility}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Volatility</div>
                    </div>
                  </div>
                )}

                {result.assessmentType === 'values' && (
                  <div>
                    <div className="text-sm text-[var(--color-text-muted)] mb-2">Top Core Values:</div>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const value = result.scores[`top${i}`];
                        return value ? (
                          <span
                            key={i}
                            className="px-3 py-1 bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] rounded-full text-sm font-medium"
                          >
                            {value}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {result.assessmentType === 'iq' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[var(--color-layer-education)]">
                        {result.scores.iqEstimate}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Est. IQ</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[var(--color-accent-primary)]">
                        {result.scores.percentile}th
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Percentile</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {result.scores.accuracy}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Accuracy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {result.scores.correct}/{result.scores.total}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Correct</div>
                    </div>
                  </div>
                )}

                {result.assessmentType === 'personality_mbti' && (
                  <div className="flex items-center gap-6">
                    <div className="flex gap-1">
                      {String(result.scores.type).split('').map((letter, i) => (
                        <span
                          key={i}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)] font-bold text-lg"
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                    <div className="text-[var(--color-text-secondary)]">
                      {result.scores.type} Personality Type
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
