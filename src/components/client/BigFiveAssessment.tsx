'use client';

import { useState, useEffect, useCallback } from 'react';
import { assessments } from '@/lib/db';
import type { AssessmentResult } from '@/types';

// Big Five traits
type Trait = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

interface Question {
  id: number;
  text: string;
  trait: Trait;
  reversed: boolean; // Some questions are reverse-scored
}

// Big Five questions - 10 per trait, mix of positive and negative framing
const QUESTIONS: Question[] = [
  // Openness (O)
  { id: 1, text: 'I have a vivid imagination.', trait: 'openness', reversed: false },
  { id: 2, text: 'I am interested in abstract ideas.', trait: 'openness', reversed: false },
  { id: 3, text: 'I have excellent ideas.', trait: 'openness', reversed: false },
  { id: 4, text: 'I am quick to understand things.', trait: 'openness', reversed: false },
  { id: 5, text: 'I enjoy artistic and creative experiences.', trait: 'openness', reversed: false },
  { id: 6, text: 'I prefer variety to routine.', trait: 'openness', reversed: false },
  { id: 7, text: 'I am not interested in abstract ideas.', trait: 'openness', reversed: true },
  { id: 8, text: 'I do not have a good imagination.', trait: 'openness', reversed: true },
  { id: 9, text: 'I have difficulty understanding abstract ideas.', trait: 'openness', reversed: true },
  { id: 10, text: 'I am curious about many different things.', trait: 'openness', reversed: false },

  // Conscientiousness (C)
  { id: 11, text: 'I am always prepared.', trait: 'conscientiousness', reversed: false },
  { id: 12, text: 'I pay attention to details.', trait: 'conscientiousness', reversed: false },
  { id: 13, text: 'I get chores done right away.', trait: 'conscientiousness', reversed: false },
  { id: 14, text: 'I follow a schedule.', trait: 'conscientiousness', reversed: false },
  { id: 15, text: 'I am exacting in my work.', trait: 'conscientiousness', reversed: false },
  { id: 16, text: 'I leave my belongings around.', trait: 'conscientiousness', reversed: true },
  { id: 17, text: 'I make a mess of things.', trait: 'conscientiousness', reversed: true },
  { id: 18, text: 'I often forget to put things back in their proper place.', trait: 'conscientiousness', reversed: true },
  { id: 19, text: 'I shirk my duties.', trait: 'conscientiousness', reversed: true },
  { id: 20, text: 'I complete tasks successfully.', trait: 'conscientiousness', reversed: false },

  // Extraversion (E)
  { id: 21, text: 'I am the life of the party.', trait: 'extraversion', reversed: false },
  { id: 22, text: 'I feel comfortable around people.', trait: 'extraversion', reversed: false },
  { id: 23, text: 'I start conversations.', trait: 'extraversion', reversed: false },
  { id: 24, text: 'I talk to a lot of different people at parties.', trait: 'extraversion', reversed: false },
  { id: 25, text: 'I don\'t mind being the center of attention.', trait: 'extraversion', reversed: false },
  { id: 26, text: 'I don\'t talk a lot.', trait: 'extraversion', reversed: true },
  { id: 27, text: 'I keep in the background.', trait: 'extraversion', reversed: true },
  { id: 28, text: 'I have little to say.', trait: 'extraversion', reversed: true },
  { id: 29, text: 'I don\'t like to draw attention to myself.', trait: 'extraversion', reversed: true },
  { id: 30, text: 'I feel energized by social gatherings.', trait: 'extraversion', reversed: false },

  // Agreeableness (A)
  { id: 31, text: 'I am interested in people.', trait: 'agreeableness', reversed: false },
  { id: 32, text: 'I sympathize with others\' feelings.', trait: 'agreeableness', reversed: false },
  { id: 33, text: 'I have a soft heart.', trait: 'agreeableness', reversed: false },
  { id: 34, text: 'I take time out for others.', trait: 'agreeableness', reversed: false },
  { id: 35, text: 'I feel others\' emotions.', trait: 'agreeableness', reversed: false },
  { id: 36, text: 'I make people feel at ease.', trait: 'agreeableness', reversed: false },
  { id: 37, text: 'I am not really interested in others.', trait: 'agreeableness', reversed: true },
  { id: 38, text: 'I insult people.', trait: 'agreeableness', reversed: true },
  { id: 39, text: 'I am not interested in other people\'s problems.', trait: 'agreeableness', reversed: true },
  { id: 40, text: 'I am helpful and unselfish with others.', trait: 'agreeableness', reversed: false },

  // Neuroticism (N)
  { id: 41, text: 'I get stressed out easily.', trait: 'neuroticism', reversed: false },
  { id: 42, text: 'I worry about things.', trait: 'neuroticism', reversed: false },
  { id: 43, text: 'I am easily disturbed.', trait: 'neuroticism', reversed: false },
  { id: 44, text: 'I get upset easily.', trait: 'neuroticism', reversed: false },
  { id: 45, text: 'I change my mood a lot.', trait: 'neuroticism', reversed: false },
  { id: 46, text: 'I have frequent mood swings.', trait: 'neuroticism', reversed: false },
  { id: 47, text: 'I get irritated easily.', trait: 'neuroticism', reversed: false },
  { id: 48, text: 'I often feel blue.', trait: 'neuroticism', reversed: false },
  { id: 49, text: 'I am relaxed most of the time.', trait: 'neuroticism', reversed: true },
  { id: 50, text: 'I seldom feel blue.', trait: 'neuroticism', reversed: true },
];

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Likert scale options
const LIKERT_OPTIONS = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
];

interface TraitResult {
  score: number;
  percentile: number;
  label: string;
  description: string;
}

interface BigFiveResults {
  openness: TraitResult;
  conscientiousness: TraitResult;
  extraversion: TraitResult;
  agreeableness: TraitResult;
  neuroticism: TraitResult;
}

const TRAIT_INFO: Record<Trait, { name: string; highLabel: string; lowLabel: string; highDesc: string; lowDesc: string }> = {
  openness: {
    name: 'Openness',
    highLabel: 'Inventive/Curious',
    lowLabel: 'Consistent/Cautious',
    highDesc: 'You embrace new ideas and experiences. You tend to be creative, curious, and open to unconventional perspectives.',
    lowDesc: 'You prefer familiar routines and practical approaches. You tend to be pragmatic and focused on concrete realities.',
  },
  conscientiousness: {
    name: 'Conscientiousness',
    highLabel: 'Efficient/Organized',
    lowLabel: 'Flexible/Spontaneous',
    highDesc: 'You are well-organized and self-disciplined. You prefer planned activities and pay attention to details.',
    lowDesc: 'You prefer flexibility over structure. You tend to be spontaneous and adaptable to changing circumstances.',
  },
  extraversion: {
    name: 'Extraversion',
    highLabel: 'Outgoing/Energetic',
    lowLabel: 'Reserved/Reflective',
    highDesc: 'You gain energy from social interactions. You tend to be talkative, assertive, and enjoy being around others.',
    lowDesc: 'You prefer solitary activities and smaller groups. You tend to be thoughtful and value time for reflection.',
  },
  agreeableness: {
    name: 'Agreeableness',
    highLabel: 'Friendly/Compassionate',
    lowLabel: 'Analytical/Detached',
    highDesc: 'You prioritize cooperation and getting along with others. You tend to be trusting, helpful, and empathetic.',
    lowDesc: 'You prioritize objectivity over social harmony. You tend to be more skeptical and competitive.',
  },
  neuroticism: {
    name: 'Emotional Stability',
    highLabel: 'Sensitive/Nervous',
    lowLabel: 'Secure/Confident',
    highDesc: 'You experience emotions intensely and may be more sensitive to stress. You tend to be more vigilant about potential problems.',
    lowDesc: 'You are emotionally resilient and calm under pressure. You tend to be less reactive to stress.',
  },
};

const TRAIT_COLORS: Record<Trait, string> = {
  openness: 'var(--color-layer-education)',
  conscientiousness: 'var(--color-layer-work)',
  extraversion: 'var(--color-layer-relationships)',
  agreeableness: 'var(--color-accent-primary)',
  neuroticism: 'var(--color-layer-health)',
};

interface BigFiveAssessmentProps {
  onComplete?: (results: AssessmentResult) => void;
  onCancel?: () => void;
}

export function BigFiveAssessment({ onComplete, onCancel }: BigFiveAssessmentProps) {
  const [questions] = useState(() => shuffleArray(QUESTIONS));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [startTime] = useState(Date.now());
  const [results, setResults] = useState<BigFiveResults | null>(null);
  const [saving, setSaving] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = (Object.keys(answers).length / questions.length) * 100;
  const isComplete = Object.keys(answers).length === questions.length;

  const calculateResults = useCallback((): BigFiveResults => {
    const traitScores: Record<Trait, number[]> = {
      openness: [],
      conscientiousness: [],
      extraversion: [],
      agreeableness: [],
      neuroticism: [],
    };

    // Collect scores for each trait
    QUESTIONS.forEach((q) => {
      const answer = answers[q.id];
      if (answer !== undefined) {
        // Reverse score if needed (5 becomes 1, 4 becomes 2, etc.)
        const score = q.reversed ? 6 - answer : answer;
        traitScores[q.trait].push(score);
      }
    });

    // Calculate average score and percentile for each trait
    const calculateTraitResult = (trait: Trait): TraitResult => {
      const scores = traitScores[trait];
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      // Convert to 0-100 scale
      const percentile = Math.round(((average - 1) / 4) * 100);
      const info = TRAIT_INFO[trait];

      return {
        score: Math.round(average * 10) / 10,
        percentile,
        label: percentile >= 50 ? info.highLabel : info.lowLabel,
        description: percentile >= 50 ? info.highDesc : info.lowDesc,
      };
    };

    return {
      openness: calculateTraitResult('openness'),
      conscientiousness: calculateTraitResult('conscientiousness'),
      extraversion: calculateTraitResult('extraversion'),
      agreeableness: calculateTraitResult('agreeableness'),
      neuroticism: calculateTraitResult('neuroticism'),
    };
  }, [answers]);

  const handleAnswer = (value: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));

    // Auto-advance to next question
    if (currentIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 150);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleComplete = async () => {
    const finalResults = calculateResults();
    setResults(finalResults);

    setSaving(true);
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const assessmentResult: AssessmentResult = {
        id: `big5-${Date.now()}`,
        userId: 'default-user',
        assessmentType: 'personality_big5',
        completedAt: new Date(),
        duration,
        scores: {
          openness: finalResults.openness.percentile,
          conscientiousness: finalResults.conscientiousness.percentile,
          extraversion: finalResults.extraversion.percentile,
          agreeableness: finalResults.agreeableness.percentile,
          neuroticism: finalResults.neuroticism.percentile,
          openness_raw: finalResults.openness.score,
          conscientiousness_raw: finalResults.conscientiousness.score,
          extraversion_raw: finalResults.extraversion.score,
          agreeableness_raw: finalResults.agreeableness.score,
          neuroticism_raw: finalResults.neuroticism.score,
        },
      };

      await assessments.add(assessmentResult);
      onComplete?.(assessmentResult);
    } catch (error) {
      console.error('Failed to save assessment:', error);
    } finally {
      setSaving(false);
    }
  };

  // Show results view
  if (results) {
    const traits: Trait[] = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

    return (
      <div className="fade-in">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Your Big Five Results</h2>
          <p className="text-[var(--color-text-secondary)]">
            Here&apos;s how you scored on each personality dimension
          </p>
        </div>

        <div className="space-y-6 mb-8">
          {traits.map((trait) => {
            const result = results[trait];
            const info = TRAIT_INFO[trait];

            return (
              <div key={trait} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{info.name}</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">{result.label}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold" style={{ color: TRAIT_COLORS[trait] }}>
                      {result.percentile}%
                    </span>
                  </div>
                </div>

                <div className="relative h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden mb-3">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${result.percentile}%`,
                      backgroundColor: TRAIT_COLORS[trait],
                    }}
                  />
                </div>

                <p className="text-sm text-[var(--color-text-secondary)]">
                  {result.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="btn btn-secondary flex-1"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  // Show assessment questions
  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Big Five Personality Assessment</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Cancel assessment"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden mb-8">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-accent-primary)] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Question */}
      <div className="card mb-6">
        <p className="text-lg mb-6">{currentQuestion.text}</p>

        <div className="space-y-3">
          {LIKERT_OPTIONS.map((option) => {
            const isSelected = answers[currentQuestion.id] === option.value;

            return (
              <button
                key={option.value}
                onClick={() => handleAnswer(option.value)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]'
                        : 'border-[var(--color-text-muted)]'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className={isSelected ? 'font-medium' : ''}>{option.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="btn btn-secondary"
        >
          Previous
        </button>

        <div className="text-sm text-[var(--color-text-muted)]">
          {Object.keys(answers).length} / {questions.length} answered
        </div>

        {isComplete ? (
          <button
            onClick={handleComplete}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'See Results'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1 || !answers[currentQuestion.id]}
            className="btn btn-primary"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
