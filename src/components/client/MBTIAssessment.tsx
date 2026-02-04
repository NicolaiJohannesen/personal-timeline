'use client';

import { useState, useCallback } from 'react';
import { assessments, timelineEvents } from '@/lib/db';
import type { AssessmentResult } from '@/types';

// MBTI Dichotomies
type Dichotomy = 'EI' | 'SN' | 'TF' | 'JP';

interface Question {
  id: number;
  text: string;
  dichotomy: Dichotomy;
  // 'a' aligns with first letter (E, S, T, J), 'b' aligns with second (I, N, F, P)
  optionA: string;
  optionB: string;
}

// 20 questions covering all 4 dichotomies (5 each)
const QUESTIONS: Question[] = [
  // E vs I (5 questions)
  {
    id: 1,
    text: 'At a party, you tend to:',
    dichotomy: 'EI',
    optionA: 'Interact with many people, including strangers',
    optionB: 'Interact with a few people you know well',
  },
  {
    id: 2,
    text: 'When working on a project, you prefer to:',
    dichotomy: 'EI',
    optionA: 'Discuss ideas with others as you develop them',
    optionB: 'Think things through before sharing your ideas',
  },
  {
    id: 3,
    text: 'You feel more energized after:',
    dichotomy: 'EI',
    optionA: 'Spending time with a group of people',
    optionB: 'Spending time alone or with one close person',
  },
  {
    id: 4,
    text: 'When learning something new, you prefer:',
    dichotomy: 'EI',
    optionA: 'Group discussions and activities',
    optionB: 'Reading and reflecting on your own',
  },
  {
    id: 5,
    text: 'In conversations, you tend to:',
    dichotomy: 'EI',
    optionA: 'Think out loud and speak quickly',
    optionB: 'Pause to collect your thoughts before speaking',
  },

  // S vs N (5 questions)
  {
    id: 6,
    text: 'You are more interested in:',
    dichotomy: 'SN',
    optionA: 'What is actual and present',
    optionB: 'What is possible and future-oriented',
  },
  {
    id: 7,
    text: 'When solving problems, you prefer to:',
    dichotomy: 'SN',
    optionA: 'Use tried-and-true methods',
    optionB: 'Try new, innovative approaches',
  },
  {
    id: 8,
    text: 'You tend to focus more on:',
    dichotomy: 'SN',
    optionA: 'Specific details and facts',
    optionB: 'The big picture and patterns',
  },
  {
    id: 9,
    text: 'When reading, you prefer:',
    dichotomy: 'SN',
    optionA: 'Literal, straightforward content',
    optionB: 'Figurative, symbolic content',
  },
  {
    id: 10,
    text: 'You trust more:',
    dichotomy: 'SN',
    optionA: 'Your direct experience and observations',
    optionB: 'Your hunches and intuitions',
  },

  // T vs F (5 questions)
  {
    id: 11,
    text: 'When making decisions, you prioritize:',
    dichotomy: 'TF',
    optionA: 'Logic and objective analysis',
    optionB: 'Personal values and how others will be affected',
  },
  {
    id: 12,
    text: 'In conflicts, you tend to:',
    dichotomy: 'TF',
    optionA: 'Focus on finding the most logical solution',
    optionB: 'Focus on maintaining harmony and understanding feelings',
  },
  {
    id: 13,
    text: 'You are more impressed by:',
    dichotomy: 'TF',
    optionA: "Someone's competence and achievements",
    optionB: "Someone's warmth and caring nature",
  },
  {
    id: 14,
    text: 'Criticism is easier to give when it is:',
    dichotomy: 'TF',
    optionA: 'Direct and to the point',
    optionB: 'Gentle and considerate of feelings',
  },
  {
    id: 15,
    text: 'You believe it is worse to be:',
    dichotomy: 'TF',
    optionA: 'Unjust or unfair',
    optionB: 'Merciless or unkind',
  },

  // J vs P (5 questions)
  {
    id: 16,
    text: 'You prefer to:',
    dichotomy: 'JP',
    optionA: 'Have things decided and settled',
    optionB: 'Keep your options open',
  },
  {
    id: 17,
    text: 'When working on a deadline, you:',
    dichotomy: 'JP',
    optionA: 'Plan ahead and finish early',
    optionB: 'Work best under pressure close to the deadline',
  },
  {
    id: 18,
    text: 'Your workspace tends to be:',
    dichotomy: 'JP',
    optionA: 'Organized and orderly',
    optionB: 'Flexible and adaptable to current needs',
  },
  {
    id: 19,
    text: 'When starting a project, you prefer to:',
    dichotomy: 'JP',
    optionA: 'Create a detailed plan first',
    optionB: 'Dive in and figure it out as you go',
  },
  {
    id: 20,
    text: 'Unexpected changes in plans make you feel:',
    dichotomy: 'JP',
    optionA: 'Uncomfortable and stressed',
    optionB: 'Excited about new possibilities',
  },
];

const TYPE_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  ISTJ: {
    title: 'The Inspector',
    description: 'Responsible, sincere, analytical, reserved, realistic, systematic. Hardworking and trustworthy with sound practical judgment.',
  },
  ISFJ: {
    title: 'The Protector',
    description: 'Warm, considerate, gentle, responsible, pragmatic, thorough. Devoted caretakers who enjoy being helpful to others.',
  },
  INFJ: {
    title: 'The Counselor',
    description: 'Idealistic, organized, insightful, dependable, compassionate, gentle. Seek meaning and connection in ideas and relationships.',
  },
  INTJ: {
    title: 'The Mastermind',
    description: 'Innovative, independent, strategic, logical, reserved, insightful. Driven by their own original ideas to achieve improvements.',
  },
  ISTP: {
    title: 'The Craftsman',
    description: 'Action-oriented, logical, analytical, spontaneous, reserved, independent. Excel at troubleshooting and hands-on problem solving.',
  },
  ISFP: {
    title: 'The Composer',
    description: 'Gentle, sensitive, helpful, flexible, realistic, modest. Seek to create a personal environment that is both beautiful and practical.',
  },
  INFP: {
    title: 'The Healer',
    description: 'Idealistic, empathetic, creative, reserved, values-driven, adaptable. Seek to understand themselves and help others fulfill their potential.',
  },
  INTP: {
    title: 'The Architect',
    description: 'Intellectual, logical, precise, reserved, flexible, imaginative. Original thinkers who enjoy speculation and creative problem solving.',
  },
  ESTP: {
    title: 'The Dynamo',
    description: 'Outgoing, realistic, action-oriented, curious, versatile, spontaneous. Pragmatic problem solvers and skillful negotiators.',
  },
  ESFP: {
    title: 'The Performer',
    description: 'Playful, enthusiastic, friendly, spontaneous, tactful, flexible. Have strong common sense, enjoy helping people in tangible ways.',
  },
  ENFP: {
    title: 'The Champion',
    description: 'Enthusiastic, creative, sociable, free-spirited, values-driven, optimistic. See life as full of possibilities and make connections between events.',
  },
  ENTP: {
    title: 'The Visionary',
    description: 'Inventive, enthusiastic, strategic, enterprising, inquisitive, versatile. Enjoy new ideas and challenges, value inspiration.',
  },
  ESTJ: {
    title: 'The Supervisor',
    description: 'Efficient, outgoing, analytical, systematic, dependable, realistic. Like to run the show and get things done in an orderly fashion.',
  },
  ESFJ: {
    title: 'The Provider',
    description: 'Friendly, outgoing, reliable, conscientious, organized, practical. Seek to be helpful and please others, enjoy being active and productive.',
  },
  ENFJ: {
    title: 'The Teacher',
    description: 'Caring, enthusiastic, idealistic, organized, diplomatic, responsible. Highly attuned to the emotions and needs of others.',
  },
  ENTJ: {
    title: 'The Commander',
    description: 'Strategic, logical, efficient, outgoing, ambitious, independent. Natural leaders who organize people and processes to achieve goals.',
  },
};

interface MBTIAssessmentProps {
  onComplete?: (result: AssessmentResult) => void;
  onCancel?: () => void;
}

export function MBTIAssessment({ onComplete, onCancel }: MBTIAssessmentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b'>>({});
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mbtiType, setMbtiType] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<Dichotomy, { first: number; second: number }> | null>(null);

  const question = QUESTIONS[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;

  const handleAnswer = useCallback((answer: 'a' | 'b') => {
    setAnswers(prev => ({ ...prev, [question.id]: answer }));

    // Auto-advance to next question
    if (currentQuestion < QUESTIONS.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(prev => prev + 1);
      }, 300);
    }
  }, [currentQuestion, question.id]);

  const calculateResults = useCallback(() => {
    const dichotomyScores: Record<Dichotomy, { first: number; second: number }> = {
      EI: { first: 0, second: 0 },
      SN: { first: 0, second: 0 },
      TF: { first: 0, second: 0 },
      JP: { first: 0, second: 0 },
    };

    // Count answers for each dichotomy
    QUESTIONS.forEach(q => {
      const answer = answers[q.id];
      if (answer === 'a') {
        dichotomyScores[q.dichotomy].first++;
      } else if (answer === 'b') {
        dichotomyScores[q.dichotomy].second++;
      }
    });

    // Determine type
    const type = [
      dichotomyScores.EI.first >= dichotomyScores.EI.second ? 'E' : 'I',
      dichotomyScores.SN.first >= dichotomyScores.SN.second ? 'S' : 'N',
      dichotomyScores.TF.first >= dichotomyScores.TF.second ? 'T' : 'F',
      dichotomyScores.JP.first >= dichotomyScores.JP.second ? 'J' : 'P',
    ].join('');

    return { type, scores: dichotomyScores };
  }, [answers]);

  const handleComplete = useCallback(async () => {
    if (answeredCount < QUESTIONS.length) return;

    const { type, scores: calculatedScores } = calculateResults();
    setMbtiType(type);
    setScores(calculatedScores);
    setShowResults(true);
    setIsSaving(true);

    try {
      // Calculate percentages for each dichotomy
      const percentages = {
        E: Math.round((calculatedScores.EI.first / 5) * 100),
        I: Math.round((calculatedScores.EI.second / 5) * 100),
        S: Math.round((calculatedScores.SN.first / 5) * 100),
        N: Math.round((calculatedScores.SN.second / 5) * 100),
        T: Math.round((calculatedScores.TF.first / 5) * 100),
        F: Math.round((calculatedScores.TF.second / 5) * 100),
        J: Math.round((calculatedScores.JP.first / 5) * 100),
        P: Math.round((calculatedScores.JP.second / 5) * 100),
      };

      const result: AssessmentResult = {
        id: crypto.randomUUID(),
        assessmentType: 'personality_mbti',
        completedAt: new Date(),
        scores: {
          type,
          percentages,
          rawScores: calculatedScores,
        },
        duration: 0,
      };

      await assessments.add(result);

      // Also save as a timeline event
      await timelineEvents.add({
        id: crypto.randomUUID(),
        title: `MBTI Personality Assessment: ${type}`,
        description: `Completed MBTI-style personality assessment. Result: ${type} - ${TYPE_DESCRIPTIONS[type]?.title || 'Unknown Type'}`,
        startDate: new Date(),
        layer: 'health',
        eventType: 'assessment',
        source: 'manual',
        metadata: { assessmentId: result.id },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      onComplete?.(result);
    } catch (error) {
      console.error('Failed to save assessment:', error);
    } finally {
      setIsSaving(false);
    }
  }, [answeredCount, calculateResults, onComplete]);

  if (showResults && mbtiType && scores) {
    const typeInfo = TYPE_DESCRIPTIONS[mbtiType] || { title: 'Unknown', description: '' };

    return (
      <div className="fade-in max-w-2xl mx-auto">
        <div className="card-elevated">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Your Personality Type</h2>
              <p className="text-[var(--color-text-secondary)]">
                Based on the Myers-Briggs Type Indicator framework
              </p>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Type Display */}
          <div className="text-center mb-8">
            <div className="inline-flex gap-2 text-5xl font-bold mb-4">
              {mbtiType.split('').map((letter, i) => (
                <span
                  key={i}
                  className="w-16 h-16 flex items-center justify-center rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]"
                >
                  {letter}
                </span>
              ))}
            </div>
            <h3 className="text-2xl font-semibold text-[var(--color-accent-primary)] mb-2">
              {typeInfo.title}
            </h3>
            <p className="text-[var(--color-text-secondary)] max-w-lg mx-auto">
              {typeInfo.description}
            </p>
          </div>

          {/* Dichotomy Breakdown */}
          <div className="space-y-6 mb-8">
            <h4 className="text-lg font-semibold">Your Preferences</h4>

            {/* E/I */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className={scores.EI.first >= scores.EI.second ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Extraversion (E)
                </span>
                <span className={scores.EI.second > scores.EI.first ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Introversion (I)
                </span>
              </div>
              <div className="h-3 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden flex">
                <div
                  className="bg-[var(--color-accent-primary)] transition-all"
                  style={{ width: `${(scores.EI.first / 5) * 100}%` }}
                />
                <div
                  className="bg-[var(--color-accent-secondary)] transition-all"
                  style={{ width: `${(scores.EI.second / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* S/N */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className={scores.SN.first >= scores.SN.second ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Sensing (S)
                </span>
                <span className={scores.SN.second > scores.SN.first ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Intuition (N)
                </span>
              </div>
              <div className="h-3 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden flex">
                <div
                  className="bg-[var(--color-accent-primary)] transition-all"
                  style={{ width: `${(scores.SN.first / 5) * 100}%` }}
                />
                <div
                  className="bg-[var(--color-accent-secondary)] transition-all"
                  style={{ width: `${(scores.SN.second / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* T/F */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className={scores.TF.first >= scores.TF.second ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Thinking (T)
                </span>
                <span className={scores.TF.second > scores.TF.first ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Feeling (F)
                </span>
              </div>
              <div className="h-3 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden flex">
                <div
                  className="bg-[var(--color-accent-primary)] transition-all"
                  style={{ width: `${(scores.TF.first / 5) * 100}%` }}
                />
                <div
                  className="bg-[var(--color-accent-secondary)] transition-all"
                  style={{ width: `${(scores.TF.second / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* J/P */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className={scores.JP.first >= scores.JP.second ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Judging (J)
                </span>
                <span className={scores.JP.second > scores.JP.first ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}>
                  Perceiving (P)
                </span>
              </div>
              <div className="h-3 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden flex">
                <div
                  className="bg-[var(--color-accent-primary)] transition-all"
                  style={{ width: `${(scores.JP.first / 5) * 100}%` }}
                />
                <div
                  className="bg-[var(--color-accent-secondary)] transition-all"
                  style={{ width: `${(scores.JP.second / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg text-sm text-[var(--color-text-muted)] mb-6">
            <strong>Note:</strong> This is a simplified MBTI-style assessment for self-reflection purposes.
            For a comprehensive personality assessment, consider consulting a certified practitioner.
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            {onCancel && (
              <button onClick={onCancel} className="btn btn-primary flex-1">
                {isSaving ? 'Saving...' : 'Back to Assessments'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in max-w-2xl mx-auto">
      <div className="card-elevated">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">MBTI Personality Assessment</h2>
            <p className="text-[var(--color-text-secondary)]">
              Discover your personality type based on how you prefer to interact with the world
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--color-text-muted)]">
              Question {currentQuestion + 1} of {QUESTIONS.length}
            </span>
            <span className="text-[var(--color-accent-primary)]">
              {answeredCount} answered
            </span>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-6">{question.text}</h3>

          <div className="space-y-4">
            <button
              onClick={() => handleAnswer('a')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                answers[question.id] === 'a'
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/50'
              }`}
              aria-pressed={answers[question.id] === 'a'}
            >
              <span className="font-medium">A.</span> {question.optionA}
            </button>

            <button
              onClick={() => handleAnswer('b')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                answers[question.id] === 'b'
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent-primary)]/50'
              }`}
              aria-pressed={answers[question.id] === 'b'}
            >
              <span className="font-medium">B.</span> {question.optionB}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className="btn btn-ghost"
          >
            Previous
          </button>

          {answeredCount === QUESTIONS.length ? (
            <button onClick={handleComplete} className="btn btn-primary">
              See Results
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(prev => Math.min(QUESTIONS.length - 1, prev + 1))}
              disabled={currentQuestion === QUESTIONS.length - 1}
              className="btn btn-ghost"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MBTIAssessment;
