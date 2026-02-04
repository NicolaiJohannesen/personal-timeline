'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { assessments } from '@/lib/db';
import type { AssessmentResult } from '@/types';

interface CognitiveAssessmentProps {
  onComplete?: (result: AssessmentResult) => void;
  onCancel?: () => void;
}

interface Question {
  id: string;
  type: 'pattern' | 'verbal' | 'numerical' | 'spatial';
  difficulty: 1 | 2 | 3;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  timeLimit: number; // seconds
}

const QUESTIONS: Question[] = [
  // Pattern Recognition (8 questions)
  {
    id: 'p1',
    type: 'pattern',
    difficulty: 1,
    question: 'What number comes next in the sequence? 2, 4, 6, 8, __',
    options: ['9', '10', '11', '12'],
    correctAnswer: 1,
    explanation: 'Each number increases by 2.',
    timeLimit: 30,
  },
  {
    id: 'p2',
    type: 'pattern',
    difficulty: 1,
    question: 'What comes next? A, C, E, G, __',
    options: ['H', 'I', 'J', 'K'],
    correctAnswer: 1,
    explanation: 'Every other letter in the alphabet.',
    timeLimit: 30,
  },
  {
    id: 'p3',
    type: 'pattern',
    difficulty: 2,
    question: 'What number comes next? 1, 1, 2, 3, 5, 8, __',
    options: ['11', '12', '13', '14'],
    correctAnswer: 2,
    explanation: 'Fibonacci sequence: each number is the sum of the two preceding ones.',
    timeLimit: 45,
  },
  {
    id: 'p4',
    type: 'pattern',
    difficulty: 2,
    question: 'What comes next? 3, 6, 12, 24, __',
    options: ['36', '42', '48', '54'],
    correctAnswer: 2,
    explanation: 'Each number is doubled.',
    timeLimit: 45,
  },
  {
    id: 'p5',
    type: 'pattern',
    difficulty: 2,
    question: 'What number comes next? 1, 4, 9, 16, 25, __',
    options: ['30', '32', '36', '49'],
    correctAnswer: 2,
    explanation: 'Square numbers: 1², 2², 3², 4², 5², 6².',
    timeLimit: 45,
  },
  {
    id: 'p6',
    type: 'pattern',
    difficulty: 3,
    question: 'What comes next? 2, 6, 12, 20, 30, __',
    options: ['40', '42', '44', '48'],
    correctAnswer: 1,
    explanation: 'Differences are 4, 6, 8, 10, 12. Each difference increases by 2.',
    timeLimit: 60,
  },
  {
    id: 'p7',
    type: 'pattern',
    difficulty: 3,
    question: 'What number comes next? 1, 2, 6, 24, 120, __',
    options: ['240', '480', '600', '720'],
    correctAnswer: 3,
    explanation: 'Factorials: 1!, 2!, 3!, 4!, 5!, 6! = 720.',
    timeLimit: 60,
  },
  {
    id: 'p8',
    type: 'pattern',
    difficulty: 3,
    question: 'What comes next? Z, X, V, T, R, __',
    options: ['O', 'P', 'Q', 'S'],
    correctAnswer: 1,
    explanation: 'Backwards through the alphabet, skipping one letter each time.',
    timeLimit: 60,
  },

  // Verbal Reasoning (8 questions)
  {
    id: 'v1',
    type: 'verbal',
    difficulty: 1,
    question: 'BOOK is to READING as FORK is to:',
    options: ['Kitchen', 'Eating', 'Metal', 'Cooking'],
    correctAnswer: 1,
    explanation: 'A book is used for reading, a fork is used for eating.',
    timeLimit: 30,
  },
  {
    id: 'v2',
    type: 'verbal',
    difficulty: 1,
    question: 'Which word does NOT belong? Apple, Orange, Carrot, Banana',
    options: ['Apple', 'Orange', 'Carrot', 'Banana'],
    correctAnswer: 2,
    explanation: 'Carrot is a vegetable; the others are fruits.',
    timeLimit: 30,
  },
  {
    id: 'v3',
    type: 'verbal',
    difficulty: 2,
    question: 'ARCHITECT is to BUILDING as AUTHOR is to:',
    options: ['Library', 'Writing', 'Book', 'Publisher'],
    correctAnswer: 2,
    explanation: 'An architect creates buildings, an author creates books.',
    timeLimit: 45,
  },
  {
    id: 'v4',
    type: 'verbal',
    difficulty: 2,
    question: 'Which word is most similar to EPHEMERAL?',
    options: ['Permanent', 'Temporary', 'Solid', 'Ancient'],
    correctAnswer: 1,
    explanation: 'Ephemeral means lasting for a very short time, like temporary.',
    timeLimit: 45,
  },
  {
    id: 'v5',
    type: 'verbal',
    difficulty: 2,
    question: 'DAWN is to DUSK as BIRTH is to:',
    options: ['Life', 'Death', 'Growth', 'Age'],
    correctAnswer: 1,
    explanation: 'Dawn and dusk are opposites (beginning and end of day), as are birth and death.',
    timeLimit: 45,
  },
  {
    id: 'v6',
    type: 'verbal',
    difficulty: 3,
    question: 'Which word does NOT belong? Democracy, Monarchy, Anarchy, Geography',
    options: ['Democracy', 'Monarchy', 'Anarchy', 'Geography'],
    correctAnswer: 3,
    explanation: 'Geography is a field of study; the others are forms of government.',
    timeLimit: 60,
  },
  {
    id: 'v7',
    type: 'verbal',
    difficulty: 3,
    question: 'UBIQUITOUS is to RARE as VERBOSE is to:',
    options: ['Talkative', 'Concise', 'Written', 'Loud'],
    correctAnswer: 1,
    explanation: 'Ubiquitous (everywhere) is opposite of rare; verbose (wordy) is opposite of concise.',
    timeLimit: 60,
  },
  {
    id: 'v8',
    type: 'verbal',
    difficulty: 3,
    question: 'If all Bloops are Razzles and all Razzles are Lazzles, which must be true?',
    options: ['All Lazzles are Bloops', 'All Bloops are Lazzles', 'All Razzles are Bloops', 'Some Lazzles are Razzles'],
    correctAnswer: 1,
    explanation: 'If A→B and B→C, then A→C. All Bloops are Lazzles.',
    timeLimit: 60,
  },

  // Numerical Reasoning (8 questions)
  {
    id: 'n1',
    type: 'numerical',
    difficulty: 1,
    question: 'If a shirt costs $40 and is 25% off, what is the sale price?',
    options: ['$25', '$30', '$35', '$10'],
    correctAnswer: 1,
    explanation: '25% of $40 is $10. $40 - $10 = $30.',
    timeLimit: 45,
  },
  {
    id: 'n2',
    type: 'numerical',
    difficulty: 1,
    question: 'If 5 workers can build a wall in 10 days, how many days for 10 workers?',
    options: ['5 days', '10 days', '15 days', '20 days'],
    correctAnswer: 0,
    explanation: 'Double the workers = half the time. 10 days ÷ 2 = 5 days.',
    timeLimit: 45,
  },
  {
    id: 'n3',
    type: 'numerical',
    difficulty: 2,
    question: 'A train travels 150 km in 2.5 hours. What is its average speed?',
    options: ['50 km/h', '55 km/h', '60 km/h', '75 km/h'],
    correctAnswer: 2,
    explanation: 'Speed = Distance ÷ Time = 150 ÷ 2.5 = 60 km/h.',
    timeLimit: 45,
  },
  {
    id: 'n4',
    type: 'numerical',
    difficulty: 2,
    question: 'What is 15% of 80% of 200?',
    options: ['18', '20', '24', '30'],
    correctAnswer: 2,
    explanation: '80% of 200 = 160. 15% of 160 = 24.',
    timeLimit: 60,
  },
  {
    id: 'n5',
    type: 'numerical',
    difficulty: 2,
    question: 'If the ratio of boys to girls is 3:5 and there are 24 students, how many girls?',
    options: ['9', '12', '15', '18'],
    correctAnswer: 2,
    explanation: '3+5=8 parts. 24÷8=3 per part. Girls = 5×3 = 15.',
    timeLimit: 60,
  },
  {
    id: 'n6',
    type: 'numerical',
    difficulty: 3,
    question: 'A clock shows 3:15. What is the angle between the hour and minute hands?',
    options: ['0°', '7.5°', '15°', '22.5°'],
    correctAnswer: 1,
    explanation: 'Hour hand moves 0.5° per minute. At 3:15, hour hand is at 97.5°, minute at 90°. Difference: 7.5°.',
    timeLimit: 90,
  },
  {
    id: 'n7',
    type: 'numerical',
    difficulty: 3,
    question: 'A number increased by 20% gives 72. What is the original number?',
    options: ['54', '57.6', '60', '64'],
    correctAnswer: 2,
    explanation: 'Let x be the number. 1.2x = 72. x = 72 ÷ 1.2 = 60.',
    timeLimit: 60,
  },
  {
    id: 'n8',
    type: 'numerical',
    difficulty: 3,
    question: 'If the price of an item rises by 10%, then falls by 10%, the net change is:',
    options: ['0%', '-1%', '+1%', '-10%'],
    correctAnswer: 1,
    explanation: '100 → 110 (up 10%) → 99 (down 10% of 110). Net: -1%.',
    timeLimit: 60,
  },

  // Spatial Reasoning (6 questions - described verbally)
  {
    id: 's1',
    type: 'spatial',
    difficulty: 1,
    question: 'If you fold a square piece of paper in half, what shape do you get?',
    options: ['Triangle', 'Rectangle', 'Circle', 'Pentagon'],
    correctAnswer: 1,
    explanation: 'Folding a square in half creates a rectangle.',
    timeLimit: 30,
  },
  {
    id: 's2',
    type: 'spatial',
    difficulty: 2,
    question: 'A cube has how many edges?',
    options: ['6', '8', '10', '12'],
    correctAnswer: 3,
    explanation: 'A cube has 12 edges: 4 on top, 4 on bottom, and 4 vertical.',
    timeLimit: 45,
  },
  {
    id: 's3',
    type: 'spatial',
    difficulty: 2,
    question: 'If you look at a clock in a mirror showing 3:00, what time appears?',
    options: ['3:00', '6:00', '9:00', '12:00'],
    correctAnswer: 2,
    explanation: 'Mirror reflection reverses left-right. 3:00 appears as 9:00.',
    timeLimit: 45,
  },
  {
    id: 's4',
    type: 'spatial',
    difficulty: 2,
    question: 'How many faces does a triangular prism have?',
    options: ['3', '4', '5', '6'],
    correctAnswer: 2,
    explanation: '2 triangular ends + 3 rectangular sides = 5 faces.',
    timeLimit: 45,
  },
  {
    id: 's5',
    type: 'spatial',
    difficulty: 3,
    question: 'If you rotate the letter "N" 90° clockwise, it looks like:',
    options: ['Z', 'N', 'И', 'S'],
    correctAnswer: 0,
    explanation: 'Rotating N 90° clockwise makes it resemble Z.',
    timeLimit: 60,
  },
  {
    id: 's6',
    type: 'spatial',
    difficulty: 3,
    question: 'A paper is folded twice and a hole is punched. When unfolded, how many holes?',
    options: ['1', '2', '3', '4'],
    correctAnswer: 3,
    explanation: 'Each fold doubles the layers. 2 folds = 4 layers = 4 holes when punched.',
    timeLimit: 60,
  },
];

const TYPE_LABELS: Record<string, string> = {
  pattern: 'Pattern Recognition',
  verbal: 'Verbal Reasoning',
  numerical: 'Numerical Ability',
  spatial: 'Spatial Reasoning',
};

const TYPE_COLORS: Record<string, string> = {
  pattern: 'var(--color-layer-education)',
  verbal: 'var(--color-layer-work)',
  numerical: 'var(--color-layer-economics)',
  spatial: 'var(--color-accent-primary)',
};

export function CognitiveAssessment({ onComplete, onCancel }: CognitiveAssessmentProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answer: number; timeSpent: number }>>({});
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(QUESTIONS[0].timeLimit);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const startTime = useState(() => Date.now())[0];

  const currentQuestion = QUESTIONS[currentIndex];
  const totalQuestions = QUESTIONS.length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;
  const hasAnswered = answers[currentQuestion?.id] !== undefined;

  // Timer effect
  useEffect(() => {
    if (showResults) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-advance on timeout
          handleTimeout();
          return currentQuestion?.timeLimit || 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, showResults]);

  const handleTimeout = useCallback(() => {
    if (!answers[currentQuestion.id]) {
      // Mark as unanswered (-1)
      const timeSpent = currentQuestion.timeLimit;
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { answer: -1, timeSpent },
      }));
    }

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      setTimeRemaining(QUESTIONS[currentIndex + 1].timeLimit);
      setQuestionStartTime(Date.now());
    } else {
      setShowResults(true);
    }
  }, [currentQuestion, currentIndex, totalQuestions, answers]);

  const handleAnswer = (answerIndex: number) => {
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { answer: answerIndex, timeSpent },
    }));

    // Auto-advance after short delay
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex((prev) => prev + 1);
        setTimeRemaining(QUESTIONS[currentIndex + 1].timeLimit);
        setQuestionStartTime(Date.now());
      } else {
        setShowResults(true);
      }
    }, 500);
  };

  // Calculate results
  const results = useMemo(() => {
    if (!showResults) return null;

    let correct = 0;
    let totalTime = 0;
    const typeScores: Record<string, { correct: number; total: number; avgTime: number }> = {
      pattern: { correct: 0, total: 0, avgTime: 0 },
      verbal: { correct: 0, total: 0, avgTime: 0 },
      numerical: { correct: 0, total: 0, avgTime: 0 },
      spatial: { correct: 0, total: 0, avgTime: 0 },
    };
    const difficultyScores: Record<number, { correct: number; total: number }> = {
      1: { correct: 0, total: 0 },
      2: { correct: 0, total: 0 },
      3: { correct: 0, total: 0 },
    };

    QUESTIONS.forEach((q) => {
      const answer = answers[q.id];
      const isCorrect = answer?.answer === q.correctAnswer;

      if (isCorrect) {
        correct++;
        typeScores[q.type].correct++;
        difficultyScores[q.difficulty].correct++;
      }

      typeScores[q.type].total++;
      difficultyScores[q.difficulty].total++;

      if (answer) {
        totalTime += answer.timeSpent;
        typeScores[q.type].avgTime += answer.timeSpent;
      }
    });

    // Calculate averages
    Object.keys(typeScores).forEach((type) => {
      const ts = typeScores[type];
      ts.avgTime = ts.total > 0 ? Math.round(ts.avgTime / ts.total) : 0;
    });

    // Calculate IQ estimate (simplified)
    // Base: 100, +/- based on performance and speed
    const accuracy = correct / totalQuestions;
    const avgTimePerQuestion = totalTime / totalQuestions;
    const expectedAvgTime = 45; // seconds

    // Score components
    let iqEstimate = 100;
    iqEstimate += Math.round((accuracy - 0.5) * 60); // -30 to +30 based on accuracy
    iqEstimate += Math.round((expectedAvgTime - avgTimePerQuestion) / 3); // Time bonus/penalty

    // Clamp to reasonable range
    iqEstimate = Math.max(70, Math.min(145, iqEstimate));

    // Percentile estimate
    let percentile = 50;
    if (iqEstimate >= 130) percentile = 98;
    else if (iqEstimate >= 120) percentile = 91;
    else if (iqEstimate >= 115) percentile = 84;
    else if (iqEstimate >= 110) percentile = 75;
    else if (iqEstimate >= 100) percentile = 50;
    else if (iqEstimate >= 90) percentile = 25;
    else if (iqEstimate >= 85) percentile = 16;
    else percentile = 9;

    return {
      correct,
      total: totalQuestions,
      accuracy: Math.round(accuracy * 100),
      totalTime,
      avgTime: Math.round(avgTimePerQuestion),
      iqEstimate,
      percentile,
      typeScores,
      difficultyScores,
    };
  }, [showResults, answers]);

  const handleSave = async () => {
    if (!results) return;

    setIsSaving(true);
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);

      const scores: Record<string, number | string> = {
        iqEstimate: results.iqEstimate,
        percentile: results.percentile,
        accuracy: results.accuracy,
        correct: results.correct,
        total: results.total,
        avgTime: results.avgTime,
      };

      // Add type scores
      Object.entries(results.typeScores).forEach(([type, data]) => {
        scores[`${type}_accuracy`] = Math.round((data.correct / data.total) * 100);
        scores[`${type}_avgTime`] = data.avgTime;
      });

      const result: AssessmentResult = {
        id: crypto.randomUUID(),
        userId: 'default-user',
        assessmentType: 'iq',
        completedAt: new Date(),
        duration,
        scores,
      };

      await assessments.add(result);
      onComplete?.(result);
    } catch (error) {
      console.error('Failed to save cognitive results:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Results view
  if (showResults && results) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Results</h2>
        </div>

        {/* Main Score */}
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-6 mb-6 text-center">
          <div className="text-sm text-[var(--color-text-muted)] mb-2">Estimated IQ Score</div>
          <div className="text-5xl font-bold text-[var(--color-accent-primary)] mb-2">
            {results.iqEstimate}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            {results.percentile}th percentile
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{results.correct}/{results.total}</div>
            <div className="text-xs text-[var(--color-text-muted)]">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{results.accuracy}%</div>
            <div className="text-xs text-[var(--color-text-muted)]">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{results.avgTime}s</div>
            <div className="text-xs text-[var(--color-text-muted)]">Avg Time</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Performance by Category</h3>
          <div className="space-y-3">
            {Object.entries(results.typeScores).map(([type, data]) => {
              const accuracy = Math.round((data.correct / data.total) * 100);
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{TYPE_LABELS[type]}</span>
                    <span className="font-medium">{data.correct}/{data.total} ({accuracy}%)</span>
                  </div>
                  <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${accuracy}%`,
                        backgroundColor: TYPE_COLORS[type],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Performance by Difficulty</h3>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((diff) => {
              const data = results.difficultyScores[diff];
              const accuracy = Math.round((data.correct / data.total) * 100);
              return (
                <div key={diff} className="text-center bg-[var(--color-bg-tertiary)] rounded-lg p-3">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">
                    {diff === 1 ? 'Easy' : diff === 2 ? 'Medium' : 'Hard'}
                  </div>
                  <div className="text-lg font-bold">{accuracy}%</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {data.correct}/{data.total}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6 text-sm text-[var(--color-text-secondary)]">
          <strong className="text-amber-500">Note:</strong> This is a simplified cognitive assessment for educational purposes. True IQ tests require standardized conditions and professional administration. Results should not be used for clinical or educational decisions.
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
          <h2 className="text-2xl font-bold">Cognitive Assessment</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Test your reasoning abilities
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

      {/* Progress and Timer */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[var(--color-text-muted)]">
              Question {currentIndex + 1} of {totalQuestions}
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
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
            timeRemaining <= 10
              ? 'bg-red-500/20 text-red-500'
              : 'bg-[var(--color-bg-tertiary)]'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono font-medium">{timeRemaining}s</span>
        </div>
      </div>

      {/* Category Tag */}
      <div className="mb-4">
        <span
          className="text-xs font-medium px-2 py-1 rounded"
          style={{
            backgroundColor: `color-mix(in srgb, ${TYPE_COLORS[currentQuestion.type]} 15%, transparent)`,
            color: TYPE_COLORS[currentQuestion.type],
          }}
        >
          {TYPE_LABELS[currentQuestion.type]}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] ml-2">
          {'★'.repeat(currentQuestion.difficulty)}{'☆'.repeat(3 - currentQuestion.difficulty)}
        </span>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h3 className="text-lg font-medium">{currentQuestion.question}</h3>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => {
          const isSelected = answers[currentQuestion.id]?.answer === index;
          return (
            <button
              key={index}
              onClick={() => !hasAnswered && handleAnswer(index)}
              disabled={hasAnswered}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                isSelected
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10'
                  : hasAnswered
                  ? 'border-[var(--color-border)] opacity-50'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/50 hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <span className="font-medium mr-3 text-[var(--color-text-muted)]">
                {String.fromCharCode(65 + index)}.
              </span>
              <span className={isSelected ? 'text-[var(--color-accent-primary)]' : ''}>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navigation hint */}
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Select an answer to continue. Questions are timed.
      </p>
    </div>
  );
}
