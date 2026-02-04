'use client';

import { useState, useMemo } from 'react';
import { assessments } from '@/lib/db';
import type { AssessmentResult } from '@/types';

interface RiskToleranceAssessmentProps {
  onComplete?: (result: AssessmentResult) => void;
  onCancel?: () => void;
}

interface Question {
  id: string;
  text: string;
  options: { text: string; score: number }[];
  category: 'time_horizon' | 'volatility' | 'experience' | 'capacity' | 'attitude';
}

const QUESTIONS: Question[] = [
  // Time Horizon (3 questions)
  {
    id: 'th1',
    text: 'When do you expect to need most of the money from your investments?',
    category: 'time_horizon',
    options: [
      { text: 'Less than 3 years', score: 1 },
      { text: '3-5 years', score: 2 },
      { text: '6-10 years', score: 3 },
      { text: '11-20 years', score: 4 },
      { text: 'More than 20 years', score: 5 },
    ],
  },
  {
    id: 'th2',
    text: 'What is your primary investment goal?',
    category: 'time_horizon',
    options: [
      { text: 'Preserve capital with minimal risk', score: 1 },
      { text: 'Generate steady income', score: 2 },
      { text: 'Balance growth and income', score: 3 },
      { text: 'Long-term growth', score: 4 },
      { text: 'Maximum growth regardless of volatility', score: 5 },
    ],
  },
  {
    id: 'th3',
    text: 'At what age do you plan to retire?',
    category: 'time_horizon',
    options: [
      { text: 'Already retired or within 5 years', score: 1 },
      { text: '6-10 years from now', score: 2 },
      { text: '11-20 years from now', score: 3 },
      { text: '21-30 years from now', score: 4 },
      { text: 'More than 30 years from now', score: 5 },
    ],
  },
  // Volatility Tolerance (4 questions)
  {
    id: 'vt1',
    text: 'If your portfolio lost 20% of its value in a month, what would you do?',
    category: 'volatility',
    options: [
      { text: 'Sell everything immediately', score: 1 },
      { text: 'Sell some to reduce risk', score: 2 },
      { text: 'Hold and wait for recovery', score: 3 },
      { text: 'Buy more at lower prices', score: 4 },
      { text: 'Buy significantly more—great opportunity', score: 5 },
    ],
  },
  {
    id: 'vt2',
    text: 'How would you feel if your investments dropped 30% in a year?',
    category: 'volatility',
    options: [
      { text: 'Extremely anxious, would lose sleep', score: 1 },
      { text: 'Very concerned and worried', score: 2 },
      { text: 'Uncomfortable but would stay patient', score: 3 },
      { text: 'Somewhat concerned but confident in recovery', score: 4 },
      { text: 'Not worried at all—market fluctuations are normal', score: 5 },
    ],
  },
  {
    id: 'vt3',
    text: 'Which investment scenario would you prefer?',
    category: 'volatility',
    options: [
      { text: 'Guaranteed 3% annual return', score: 1 },
      { text: '50% chance of 5%, 50% chance of 1%', score: 2 },
      { text: '50% chance of 10%, 50% chance of 0%', score: 3 },
      { text: '50% chance of 20%, 50% chance of -5%', score: 4 },
      { text: '50% chance of 40%, 50% chance of -15%', score: 5 },
    ],
  },
  {
    id: 'vt4',
    text: 'How often do you check your investment portfolio?',
    category: 'volatility',
    options: [
      { text: 'Daily or more often', score: 2 },
      { text: 'Weekly', score: 3 },
      { text: 'Monthly', score: 4 },
      { text: 'Quarterly', score: 4 },
      { text: 'Annually or less', score: 5 },
    ],
  },
  // Investment Experience (3 questions)
  {
    id: 'ex1',
    text: 'How would you describe your investment knowledge?',
    category: 'experience',
    options: [
      { text: 'None—completely new to investing', score: 1 },
      { text: 'Limited—know the basics', score: 2 },
      { text: 'Moderate—understand stocks, bonds, and funds', score: 3 },
      { text: 'Good—actively manage investments', score: 4 },
      { text: 'Extensive—professional or expert level', score: 5 },
    ],
  },
  {
    id: 'ex2',
    text: 'How many years have you been investing?',
    category: 'experience',
    options: [
      { text: 'Never invested before', score: 1 },
      { text: 'Less than 2 years', score: 2 },
      { text: '2-5 years', score: 3 },
      { text: '6-10 years', score: 4 },
      { text: 'More than 10 years', score: 5 },
    ],
  },
  {
    id: 'ex3',
    text: 'Which investment types have you used? (Select the most complex)',
    category: 'experience',
    options: [
      { text: 'Savings accounts only', score: 1 },
      { text: 'Bonds or CDs', score: 2 },
      { text: 'Mutual funds or ETFs', score: 3 },
      { text: 'Individual stocks', score: 4 },
      { text: 'Options, futures, or crypto', score: 5 },
    ],
  },
  // Financial Capacity (3 questions)
  {
    id: 'fc1',
    text: 'How stable is your current income?',
    category: 'capacity',
    options: [
      { text: 'Very unstable or no current income', score: 1 },
      { text: 'Somewhat unstable (freelance, commission)', score: 2 },
      { text: 'Moderately stable', score: 3 },
      { text: 'Stable with regular salary', score: 4 },
      { text: 'Very stable with multiple income sources', score: 5 },
    ],
  },
  {
    id: 'fc2',
    text: 'How many months of expenses do you have in emergency savings?',
    category: 'capacity',
    options: [
      { text: 'Less than 1 month', score: 1 },
      { text: '1-2 months', score: 2 },
      { text: '3-5 months', score: 3 },
      { text: '6-12 months', score: 4 },
      { text: 'More than 12 months', score: 5 },
    ],
  },
  {
    id: 'fc3',
    text: 'What percentage of your income can you invest without affecting your lifestyle?',
    category: 'capacity',
    options: [
      { text: 'Less than 5%', score: 1 },
      { text: '5-10%', score: 2 },
      { text: '11-20%', score: 3 },
      { text: '21-30%', score: 4 },
      { text: 'More than 30%', score: 5 },
    ],
  },
  // Risk Attitude (2 questions)
  {
    id: 'ra1',
    text: 'In general, how do you feel about taking financial risks?',
    category: 'attitude',
    options: [
      { text: 'Very uncomfortable—I prefer certainty', score: 1 },
      { text: 'Somewhat uncomfortable', score: 2 },
      { text: 'Neutral—it depends on the situation', score: 3 },
      { text: 'Somewhat comfortable with calculated risks', score: 4 },
      { text: 'Very comfortable—high risk, high reward', score: 5 },
    ],
  },
  {
    id: 'ra2',
    text: 'When making important financial decisions, you primarily:',
    category: 'attitude',
    options: [
      { text: 'Focus on avoiding any possible loss', score: 1 },
      { text: 'Prioritize safety with small growth potential', score: 2 },
      { text: 'Seek balance between safety and growth', score: 3 },
      { text: 'Accept some risk for higher returns', score: 4 },
      { text: 'Pursue maximum returns regardless of risk', score: 5 },
    ],
  },
];

type RiskProfile = 'conservative' | 'moderately_conservative' | 'moderate' | 'moderately_aggressive' | 'aggressive';

interface RiskResults {
  totalScore: number;
  maxScore: number;
  percentage: number;
  profile: RiskProfile;
  categoryScores: {
    time_horizon: number;
    volatility: number;
    experience: number;
    capacity: number;
    attitude: number;
  };
}

const PROFILE_INFO: Record<RiskProfile, { title: string; description: string; allocation: string; color: string }> = {
  conservative: {
    title: 'Conservative',
    description: 'You prioritize capital preservation over growth. You prefer stability and are uncomfortable with market volatility. A conservative portfolio focuses on fixed-income investments with minimal stock exposure.',
    allocation: '20% Stocks, 70% Bonds, 10% Cash',
    color: 'var(--color-layer-health)',
  },
  moderately_conservative: {
    title: 'Moderately Conservative',
    description: 'You seek modest growth while limiting downside risk. You can tolerate some volatility but prefer a cushion of stable investments. This balanced approach leans toward safety.',
    allocation: '35% Stocks, 55% Bonds, 10% Cash',
    color: 'var(--color-layer-education)',
  },
  moderate: {
    title: 'Moderate',
    description: 'You seek a balance between growth and stability. You understand that some volatility is necessary for long-term returns but want to limit extreme swings.',
    allocation: '50% Stocks, 40% Bonds, 10% Cash',
    color: 'var(--color-accent-primary)',
  },
  moderately_aggressive: {
    title: 'Moderately Aggressive',
    description: 'You prioritize growth over stability and can handle significant market fluctuations. You have a longer time horizon and understand that short-term losses may occur.',
    allocation: '70% Stocks, 25% Bonds, 5% Cash',
    color: 'var(--color-layer-work)',
  },
  aggressive: {
    title: 'Aggressive',
    description: 'You seek maximum growth and are comfortable with high volatility. You have a long investment horizon and can withstand significant short-term losses in pursuit of long-term gains.',
    allocation: '90% Stocks, 10% Bonds, 0% Cash',
    color: 'var(--color-layer-economics)',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  time_horizon: 'Time Horizon',
  volatility: 'Volatility Tolerance',
  experience: 'Experience',
  capacity: 'Financial Capacity',
  attitude: 'Risk Attitude',
};

export function RiskToleranceAssessment({ onComplete, onCancel }: RiskToleranceAssessmentProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const startTime = useState(() => Date.now())[0];

  const currentQuestion = QUESTIONS[currentIndex];
  const progress = ((currentIndex + 1) / QUESTIONS.length) * 100;
  const isComplete = Object.keys(answers).length === QUESTIONS.length;

  // Calculate results
  const results = useMemo((): RiskResults | null => {
    if (!isComplete) return null;

    const categoryScores = {
      time_horizon: 0,
      volatility: 0,
      experience: 0,
      capacity: 0,
      attitude: 0,
    };

    const categoryCounts = {
      time_horizon: 0,
      volatility: 0,
      experience: 0,
      capacity: 0,
      attitude: 0,
    };

    let totalScore = 0;
    QUESTIONS.forEach((q) => {
      const score = answers[q.id] || 0;
      totalScore += score;
      categoryScores[q.category] += score;
      categoryCounts[q.category]++;
    });

    // Normalize category scores to percentages
    Object.keys(categoryScores).forEach((key) => {
      const k = key as keyof typeof categoryScores;
      categoryScores[k] = Math.round((categoryScores[k] / (categoryCounts[k] * 5)) * 100);
    });

    const maxScore = QUESTIONS.length * 5;
    const percentage = Math.round((totalScore / maxScore) * 100);

    let profile: RiskProfile;
    if (percentage <= 30) {
      profile = 'conservative';
    } else if (percentage <= 45) {
      profile = 'moderately_conservative';
    } else if (percentage <= 60) {
      profile = 'moderate';
    } else if (percentage <= 75) {
      profile = 'moderately_aggressive';
    } else {
      profile = 'aggressive';
    }

    return {
      totalScore,
      maxScore,
      percentage,
      profile,
      categoryScores,
    };
  }, [answers, isComplete]);

  const handleAnswer = (score: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: score }));

    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSave = async () => {
    if (!results) return;

    setIsSaving(true);
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const result: AssessmentResult = {
        id: crypto.randomUUID(),
        userId: 'default-user',
        assessmentType: 'risk_tolerance',
        completedAt: new Date(),
        duration,
        scores: {
          totalScore: results.totalScore,
          maxScore: results.maxScore,
          percentage: results.percentage,
          profile: results.profile,
          ...results.categoryScores,
        },
      };

      await assessments.add(result);
      onComplete?.(result);
    } catch (error) {
      console.error('Failed to save risk tolerance results:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Results view
  if (showResults && results) {
    const profileInfo = PROFILE_INFO[results.profile];

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Risk Profile</h2>
          <button
            onClick={() => {
              setShowResults(false);
              setCurrentIndex(0);
            }}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Retake Assessment
          </button>
        </div>

        {/* Main Profile Result */}
        <div
          className="rounded-lg p-6 mb-6 text-center"
          style={{ backgroundColor: `color-mix(in srgb, ${profileInfo.color} 15%, transparent)` }}
        >
          <div className="text-sm text-[var(--color-text-muted)] mb-2">Your Risk Tolerance</div>
          <div className="text-3xl font-bold mb-2" style={{ color: profileInfo.color }}>
            {profileInfo.title}
          </div>
          <div className="text-lg text-[var(--color-text-secondary)]">
            Score: {results.percentage}%
          </div>
        </div>

        {/* Profile Description */}
        <div className="mb-6">
          <p className="text-[var(--color-text-secondary)]">{profileInfo.description}</p>
        </div>

        {/* Suggested Allocation */}
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-6">
          <div className="text-sm text-[var(--color-text-muted)] mb-2">Suggested Asset Allocation</div>
          <div className="text-lg font-medium">{profileInfo.allocation}</div>
        </div>

        {/* Category Breakdown */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Score Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(results.categoryScores).map(([category, score]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{CATEGORY_LABELS[category]}</span>
                  <span className="font-medium">{score}%</span>
                </div>
                <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${score}%`,
                      backgroundColor: profileInfo.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Scale Visualization */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Risk Spectrum</h3>
          <div className="relative h-8 bg-gradient-to-r from-[var(--color-layer-health)] via-[var(--color-accent-primary)] to-[var(--color-layer-economics)] rounded-lg">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-[var(--color-bg-primary)] shadow-lg transition-all duration-500"
              style={{ left: `calc(${results.percentage}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
            <span>Conservative</span>
            <span>Moderate</span>
            <span>Aggressive</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6 text-sm text-[var(--color-text-secondary)]">
          <strong className="text-amber-500">Disclaimer:</strong> This assessment is for educational purposes only and should not be considered financial advice. Consult a qualified financial advisor before making investment decisions.
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

  // Question view
  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Risk Tolerance Assessment</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Understand your investment risk profile
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
            Question {currentIndex + 1} of {QUESTIONS.length}
          </span>
          <span className="text-[var(--color-text-muted)]">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent-primary)] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Category Tag */}
      <div className="mb-4">
        <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
          {CATEGORY_LABELS[currentQuestion.category]}
        </span>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h3 className="text-lg font-medium">{currentQuestion.text}</h3>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => {
          const isSelected = answers[currentQuestion.id] === option.score;
          return (
            <button
              key={index}
              onClick={() => handleAnswer(option.score)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                isSelected
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/50 hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <span className={isSelected ? 'text-[var(--color-accent-primary)]' : ''}>
                {option.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="btn btn-secondary"
        >
          Previous
        </button>
        <button onClick={onCancel} className="btn btn-secondary ml-auto">
          Cancel
        </button>
      </div>
    </div>
  );
}
