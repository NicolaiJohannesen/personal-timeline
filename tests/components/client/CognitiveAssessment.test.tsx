import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CognitiveAssessment } from '@/components/client/CognitiveAssessment';

// Mock the db module
vi.mock('@/lib/db', () => ({
  assessments: {
    add: vi.fn(() => Promise.resolve()),
  },
}));

import { assessments } from '@/lib/db';

describe('CognitiveAssessment', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial Render', () => {
    it('renders the assessment title', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Cognitive Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Test your reasoning abilities/)).toBeInTheDocument();
    });

    it('shows first question', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Question 1 of 30/)).toBeInTheDocument();
    });

    it('displays timer', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // First question has 30 second time limit
      expect(screen.getByText('30s')).toBeInTheDocument();
    });

    it('shows category tag for current question', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Pattern Recognition')).toBeInTheDocument();
    });

    it('shows difficulty stars', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Difficulty 1 = 1 filled star, 2 empty
      expect(screen.getByText('★☆☆')).toBeInTheDocument();
    });

    it('displays answer options', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('A.')).toBeInTheDocument();
      expect(screen.getByText('B.')).toBeInTheDocument();
      expect(screen.getByText('C.')).toBeInTheDocument();
      expect(screen.getByText('D.')).toBeInTheDocument();
    });
  });

  describe('Answering Questions', () => {
    it('advances to next question when answer is selected', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Click first option
      await user.click(screen.getByText('9'));

      // Wait for auto-advance
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 30/)).toBeInTheDocument();
      });
    });

    it('highlights selected answer', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const option = screen.getByText('10').closest('button');
      await user.click(option!);

      expect(option).toHaveClass('border-[var(--color-accent-primary)]');
    });

    it('disables options after answering', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('10'));

      // Other options should be disabled
      const otherOption = screen.getByText('9').closest('button');
      expect(otherOption).toBeDisabled();
    });
  });

  describe('Timer', () => {
    it('counts down from time limit', async () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('30s')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('25s')).toBeInTheDocument();
    });

    it('shows warning color when time is low', async () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await act(async () => {
        vi.advanceTimersByTime(21000); // 21 seconds elapsed, 9 remaining
      });

      const timerContainer = screen.getByText('9s').closest('div');
      expect(timerContainer).toHaveClass('bg-red-500/20');
    });

    it('auto-advances when timer expires', async () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Question 1 of 30/)).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(31000); // Past 30 second limit
      });

      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 30/)).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when close icon is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByLabelText('Close'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Results View', () => {
    async function answerAllQuestions(user: ReturnType<typeof userEvent.setup>) {
      for (let i = 0; i < 30; i++) {
        // Click first option each time
        const options = screen.getAllByRole('button').filter(
          (btn) => btn.textContent?.startsWith('A.') ||
                   btn.textContent?.startsWith('B.') ||
                   btn.textContent?.startsWith('C.') ||
                   btn.textContent?.startsWith('D.')
        );

        if (options.length > 0) {
          await user.click(options[0]);
        }

        // Wait for auto-advance
        await act(async () => {
          vi.advanceTimersByTime(600);
        });
      }
    }

    it('shows results after all questions answered', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByText('Your Results')).toBeInTheDocument();
      });
    }, 60000);

    it('displays IQ estimate', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByText('Estimated IQ Score')).toBeInTheDocument();
      });
    }, 60000);

    it('shows percentile', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByText(/th percentile/)).toBeInTheDocument();
      });
    }, 60000);

    it('shows accuracy statistics', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByText('Correct')).toBeInTheDocument();
        expect(screen.getByText('Accuracy')).toBeInTheDocument();
        expect(screen.getByText('Avg Time')).toBeInTheDocument();
      });
    }, 60000);

    it('shows performance by category', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByText('Performance by Category')).toBeInTheDocument();
        expect(screen.getByText('Pattern Recognition')).toBeInTheDocument();
        expect(screen.getByText('Verbal Reasoning')).toBeInTheDocument();
        expect(screen.getByText('Numerical Ability')).toBeInTheDocument();
        expect(screen.getByText('Spatial Reasoning')).toBeInTheDocument();
      });
    }, 60000);

    it('shows performance by difficulty', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByText('Performance by Difficulty')).toBeInTheDocument();
        expect(screen.getByText('Easy')).toBeInTheDocument();
        expect(screen.getByText('Medium')).toBeInTheDocument();
        expect(screen.getByText('Hard')).toBeInTheDocument();
      });
    }, 60000);

    it('shows disclaimer', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByText(/Note:/)).toBeInTheDocument();
        expect(screen.getByText(/simplified cognitive assessment/)).toBeInTheDocument();
      });
    }, 60000);
  });

  describe('Saving Results', () => {
    async function answerAllQuestions(user: ReturnType<typeof userEvent.setup>) {
      for (let i = 0; i < 30; i++) {
        const options = screen.getAllByRole('button').filter(
          (btn) => btn.textContent?.startsWith('A.') ||
                   btn.textContent?.startsWith('B.') ||
                   btn.textContent?.startsWith('C.') ||
                   btn.textContent?.startsWith('D.')
        );

        if (options.length > 0) {
          await user.click(options[0]);
        }

        await act(async () => {
          vi.advanceTimersByTime(600);
        });
      }
    }

    it('saves results to database and calls onComplete', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save results/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(assessments.add).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled();
      });

      // Verify saved result structure
      const savedResult = vi.mocked(assessments.add).mock.calls[0][0];
      expect(savedResult.assessmentType).toBe('iq');
      expect(savedResult.scores.iqEstimate).toBeDefined();
      expect(savedResult.scores.percentile).toBeDefined();
      expect(savedResult.scores.accuracy).toBeDefined();
      expect(savedResult.scores.correct).toBeDefined();
    }, 60000);

    it('calls onCancel when Close is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    }, 60000);
  });

  describe('Question Types', () => {
    it('shows different question types', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // First question is Pattern Recognition
      expect(screen.getByText('Pattern Recognition')).toBeInTheDocument();

      // Answer 8 pattern questions to get to verbal
      for (let i = 0; i < 8; i++) {
        const options = screen.getAllByRole('button').filter(
          (btn) => btn.textContent?.startsWith('A.')
        );
        if (options.length > 0) {
          await user.click(options[0]);
        }
        await act(async () => {
          vi.advanceTimersByTime(600);
        });
      }

      // Should now be on Verbal Reasoning
      await waitFor(() => {
        expect(screen.getByText('Verbal Reasoning')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible close button', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('shows time remaining hint', () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Select an answer to continue/)).toBeInTheDocument();
    });
  });
});
