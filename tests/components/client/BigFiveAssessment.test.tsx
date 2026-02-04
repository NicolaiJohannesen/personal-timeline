import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BigFiveAssessment } from '@/components/client/BigFiveAssessment';
import type { AssessmentResult } from '@/types';

// Mock the database
vi.mock('@/lib/db', () => ({
  assessments: {
    add: vi.fn(),
  },
}));

import { assessments } from '@/lib/db';

// Helper to answer all questions quickly
async function answerAllQuestions(user: ReturnType<typeof userEvent.setup>, answerText: string) {
  for (let i = 0; i < 50; i++) {
    await user.click(screen.getByText(answerText));
    if (i < 49) {
      await waitFor(
        () => {
          expect(screen.getByText(`Question ${i + 2} of 50`)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    }
  }
}

describe('BigFiveAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assessments.add).mockResolvedValue({
      id: 'test-id',
      userId: 'default-user',
      assessmentType: 'personality_big5',
      completedAt: new Date(),
      duration: 100,
      scores: {},
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('renders the assessment header', () => {
      render(<BigFiveAssessment />);

      expect(screen.getByText('Big Five Personality Assessment')).toBeInTheDocument();
    });

    it('shows question count', () => {
      render(<BigFiveAssessment />);

      expect(screen.getByText(/Question 1 of 50/)).toBeInTheDocument();
    });

    it('renders progress bar at 0%', () => {
      render(<BigFiveAssessment />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('shows answered count', () => {
      render(<BigFiveAssessment />);

      expect(screen.getByText('0 / 50 answered')).toBeInTheDocument();
    });

    it('renders all Likert scale options', () => {
      render(<BigFiveAssessment />);

      expect(screen.getByText('Strongly Disagree')).toBeInTheDocument();
      expect(screen.getByText('Disagree')).toBeInTheDocument();
      expect(screen.getByText('Neutral')).toBeInTheDocument();
      expect(screen.getByText('Agree')).toBeInTheDocument();
      expect(screen.getByText('Strongly Agree')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('renders Previous button disabled on first question', () => {
      render(<BigFiveAssessment />);

      const prevButton = screen.getByRole('button', { name: /Previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('renders Next button', () => {
      render(<BigFiveAssessment />);

      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    });

    it('enables Previous button after answering and moving forward', async () => {
      const user = userEvent.setup();
      render(<BigFiveAssessment />);

      // Answer first question
      await user.click(screen.getByText('Agree'));

      // Wait for auto-advance
      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 50/)).toBeInTheDocument();
      });

      const prevButton = screen.getByRole('button', { name: /Previous/i });
      expect(prevButton).not.toBeDisabled();
    });

    it('goes to previous question when Previous clicked', async () => {
      const user = userEvent.setup();
      render(<BigFiveAssessment />);

      // Answer first question and wait for auto-advance
      await user.click(screen.getByText('Agree'));
      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 50/)).toBeInTheDocument();
      });

      // Go back
      await user.click(screen.getByRole('button', { name: /Previous/i }));

      expect(screen.getByText(/Question 1 of 50/)).toBeInTheDocument();
    });
  });

  describe('Answering Questions', () => {
    it('selects an answer when clicked', async () => {
      const user = userEvent.setup();
      render(<BigFiveAssessment />);

      const agreeButton = screen.getByText('Agree').closest('button');
      await user.click(agreeButton!);

      expect(agreeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('updates answered count after answering', async () => {
      const user = userEvent.setup();
      render(<BigFiveAssessment />);

      await user.click(screen.getByText('Agree'));

      await waitFor(() => {
        expect(screen.getByText('1 / 50 answered')).toBeInTheDocument();
      });
    });

    it('updates progress bar after answering', async () => {
      const user = userEvent.setup();
      render(<BigFiveAssessment />);

      await user.click(screen.getByText('Agree'));

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '2');
      });
    });

    it('auto-advances to next question after answering', async () => {
      const user = userEvent.setup();
      render(<BigFiveAssessment />);

      await user.click(screen.getByText('Strongly Agree'));

      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 50/)).toBeInTheDocument();
      });
    });

    it('preserves previous answers when navigating back', async () => {
      const user = userEvent.setup();
      render(<BigFiveAssessment />);

      // Answer first question
      await user.click(screen.getByText('Agree'));

      // Wait for advance
      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 50/)).toBeInTheDocument();
      });

      // Go back
      await user.click(screen.getByRole('button', { name: /Previous/i }));

      // Check answer is preserved
      const agreeButton = screen.getByText('Agree').closest('button');
      expect(agreeButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Cancel Button', () => {
    it('renders cancel button when onCancel provided', () => {
      const onCancel = vi.fn();
      render(<BigFiveAssessment onCancel={onCancel} />);

      expect(screen.getByRole('button', { name: /Cancel assessment/i })).toBeInTheDocument();
    });

    it('calls onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<BigFiveAssessment onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /Cancel assessment/i }));

      expect(onCancel).toHaveBeenCalled();
    });

    it('does not render cancel button when onCancel not provided', () => {
      render(<BigFiveAssessment />);

      expect(screen.queryByRole('button', { name: /Cancel assessment/i })).not.toBeInTheDocument();
    });
  });

  describe('Completion', () => {
    it(
      'shows See Results button when all questions answered',
      async () => {
        const user = userEvent.setup();
        render(<BigFiveAssessment />);

        await answerAllQuestions(user, 'Neutral');

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
      },
      { timeout: 60000 }
    );

    it(
      'saves assessment to database on completion',
      async () => {
        const user = userEvent.setup();
        render(<BigFiveAssessment />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        await waitFor(() => {
          expect(assessments.add).toHaveBeenCalled();
        });
      },
      { timeout: 60000 }
    );

    it(
      'calls onComplete callback with results',
      async () => {
        const user = userEvent.setup();
        const onComplete = vi.fn();
        render(<BigFiveAssessment onComplete={onComplete} />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        await waitFor(() => {
          expect(onComplete).toHaveBeenCalled();
        });

        // Check result structure
        const result: AssessmentResult = onComplete.mock.calls[0][0];
        expect(result.assessmentType).toBe('personality_big5');
        expect(result.userId).toBe('default-user');
        expect(result.scores).toHaveProperty('openness');
        expect(result.scores).toHaveProperty('conscientiousness');
        expect(result.scores).toHaveProperty('extraversion');
        expect(result.scores).toHaveProperty('agreeableness');
        expect(result.scores).toHaveProperty('neuroticism');
      },
      { timeout: 60000 }
    );
  });

  describe('Results View', () => {
    it(
      'shows results after completing assessment',
      async () => {
        const user = userEvent.setup();
        render(<BigFiveAssessment />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        await waitFor(() => {
          expect(screen.getByText('Your Big Five Results')).toBeInTheDocument();
        });
      },
      { timeout: 60000 }
    );

    it(
      'displays all five trait results',
      async () => {
        const user = userEvent.setup();
        render(<BigFiveAssessment />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        await waitFor(() => {
          expect(screen.getByText('Openness')).toBeInTheDocument();
          expect(screen.getByText('Conscientiousness')).toBeInTheDocument();
          expect(screen.getByText('Extraversion')).toBeInTheDocument();
          expect(screen.getByText('Agreeableness')).toBeInTheDocument();
          expect(screen.getByText('Emotional Stability')).toBeInTheDocument();
        });
      },
      { timeout: 60000 }
    );

    it(
      'shows Back to Assessments button in results',
      async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(<BigFiveAssessment onCancel={onCancel} />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Back to Assessments/i })).toBeInTheDocument();
        });
      },
      { timeout: 60000 }
    );

    it(
      'calls onCancel when Back to Assessments clicked',
      async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(<BigFiveAssessment onCancel={onCancel} />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        // Click Back to Assessments
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Back to Assessments/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /Back to Assessments/i }));

        expect(onCancel).toHaveBeenCalled();
      },
      { timeout: 60000 }
    );
  });

  describe('Score Calculation', () => {
    it(
      'calculates neutral scores for all Neutral answers',
      async () => {
        const user = userEvent.setup();
        const onComplete = vi.fn();
        render(<BigFiveAssessment onComplete={onComplete} />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        await waitFor(() => {
          expect(onComplete).toHaveBeenCalled();
        });

        // All neutral answers should give 50% scores
        const result: AssessmentResult = onComplete.mock.calls[0][0];
        expect(result.scores.openness).toBe(50);
        expect(result.scores.conscientiousness).toBe(50);
        expect(result.scores.extraversion).toBe(50);
        expect(result.scores.agreeableness).toBe(50);
        expect(result.scores.neuroticism).toBe(50);
      },
      { timeout: 60000 }
    );
  });

  describe('Error Handling', () => {
    it(
      'handles database save error gracefully',
      async () => {
        const user = userEvent.setup();
        vi.mocked(assessments.add).mockRejectedValue(new Error('Save failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<BigFiveAssessment />);

        await answerAllQuestions(user, 'Neutral');

        // Click See Results
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /See Results/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('button', { name: /See Results/i }));

        // Should still show results despite save error
        await waitFor(() => {
          expect(screen.getByText('Your Big Five Results')).toBeInTheDocument();
        });

        expect(consoleSpy).toHaveBeenCalledWith('Failed to save assessment:', expect.any(Error));
        consoleSpy.mockRestore();
      },
      { timeout: 60000 }
    );
  });

  describe('Accessibility', () => {
    it('has accessible progress bar', () => {
      render(<BigFiveAssessment />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('has aria-pressed on answer buttons', () => {
      render(<BigFiveAssessment />);

      const buttons = screen.getAllByRole('button', { pressed: false });
      // Filter to just Likert scale buttons (5 options)
      const likertButtons = buttons.filter(
        (btn) =>
          btn.textContent &&
          ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'].includes(
            btn.textContent
          )
      );
      expect(likertButtons.length).toBe(5);
    });

    it('cancel button has accessible label', () => {
      render(<BigFiveAssessment onCancel={() => {}} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel assessment/i });
      expect(cancelButton).toHaveAttribute('aria-label', 'Cancel assessment');
    });
  });
});
