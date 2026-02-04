import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RiskToleranceAssessment } from '@/components/client/RiskToleranceAssessment';

// Mock the db module
vi.mock('@/lib/db', () => ({
  assessments: {
    add: vi.fn(() => Promise.resolve()),
  },
}));

import { assessments } from '@/lib/db';

describe('RiskToleranceAssessment', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders the assessment title', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Risk Tolerance Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Understand your investment risk profile/)).toBeInTheDocument();
    });

    it('shows first question', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument();
      expect(screen.getByText(/When do you expect to need most of the money/)).toBeInTheDocument();
    });

    it('shows progress bar at start', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // First question progress = 1/15 ≈ 7%
      expect(screen.getByText('7%')).toBeInTheDocument();
    });

    it('displays category tag for current question', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Time Horizon')).toBeInTheDocument();
    });

    it('shows all answer options', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Less than 3 years')).toBeInTheDocument();
      expect(screen.getByText('3-5 years')).toBeInTheDocument();
      expect(screen.getByText('6-10 years')).toBeInTheDocument();
      expect(screen.getByText('11-20 years')).toBeInTheDocument();
      expect(screen.getByText('More than 20 years')).toBeInTheDocument();
    });

    it('has Previous and Cancel buttons', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('has disabled Previous button on first question', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('advances to next question when answer is selected', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('3-5 years'));

      expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument();
    });

    it('allows going back to previous question', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer first question
      await user.click(screen.getByText('3-5 years'));
      expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument();

      // Go back
      await user.click(screen.getByRole('button', { name: /previous/i }));
      expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument();
    });

    it('preserves previous answer when going back', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer first question
      await user.click(screen.getByText('3-5 years'));

      // Go back
      await user.click(screen.getByRole('button', { name: /previous/i }));

      // Check that the answer is still selected (highlighted)
      const selectedOption = screen.getByText('3-5 years').closest('button');
      expect(selectedOption).toHaveClass('border-[var(--color-accent-primary)]');
    });

    it('updates progress as questions are answered', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer first question
      await user.click(screen.getByText('3-5 years'));

      // Progress should be 2/15 ≈ 13%
      expect(screen.getByText('13%')).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when close icon is clicked', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByLabelText('Close'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Results View', () => {
    // Helper to answer all questions with specific score
    async function answerAllQuestions(user: ReturnType<typeof userEvent.setup>, optionIndex: number) {
      for (let i = 0; i < 15; i++) {
        const buttons = screen.getAllByRole('button').filter(
          (btn) =>
            !btn.textContent?.match(/Previous|Cancel/) &&
            btn.getAttribute('aria-label') !== 'Close' &&
            btn.textContent?.trim() !== '' // Filter out buttons with no text (like Close icon)
        );
        if (buttons[optionIndex]) {
          await user.click(buttons[optionIndex]);
        }
      }
    }

    it('shows results after completing all questions', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer all questions (selecting first option each time - conservative)
      await answerAllQuestions(user, 0);

      await waitFor(() => {
        expect(screen.getByText('Your Risk Profile')).toBeInTheDocument();
      });
    }, 30000);

    it('shows conservative profile for low scores', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer all questions with first option (lowest score)
      await answerAllQuestions(user, 0);

      await waitFor(() => {
        // Conservative appears in profile title and risk spectrum
        const conservativeElements = screen.getAllByText('Conservative');
        expect(conservativeElements.length).toBeGreaterThanOrEqual(1);
      });
    }, 30000);

    it('shows aggressive profile for high scores', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer all questions with last option (highest score)
      await answerAllQuestions(user, 4);

      await waitFor(() => {
        // Aggressive appears in profile title and risk spectrum
        const aggressiveElements = screen.getAllByText('Aggressive');
        expect(aggressiveElements.length).toBeGreaterThanOrEqual(2);
      });
    }, 30000);

    it('displays suggested asset allocation', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user, 2); // Middle options for moderate

      await waitFor(() => {
        expect(screen.getByText('Suggested Asset Allocation')).toBeInTheDocument();
        expect(screen.getByText(/Stocks/)).toBeInTheDocument();
        expect(screen.getByText(/Bonds/)).toBeInTheDocument();
      });
    }, 30000);

    it('shows category breakdown', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user, 2);

      await waitFor(() => {
        expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Time Horizon')).toBeInTheDocument();
        expect(screen.getByText('Volatility Tolerance')).toBeInTheDocument();
        expect(screen.getByText('Experience')).toBeInTheDocument();
        expect(screen.getByText('Financial Capacity')).toBeInTheDocument();
        expect(screen.getByText('Risk Attitude')).toBeInTheDocument();
      });
    }, 30000);

    it('shows risk spectrum visualization', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user, 2);

      await waitFor(() => {
        expect(screen.getByText('Risk Spectrum')).toBeInTheDocument();
        expect(screen.getByText('Moderate')).toBeInTheDocument();
      });
    }, 30000);

    it('shows disclaimer', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user, 2);

      await waitFor(() => {
        expect(screen.getByText(/Disclaimer:/)).toBeInTheDocument();
        expect(screen.getByText(/educational purposes only/)).toBeInTheDocument();
      });
    }, 30000);

    it('shows Close and Save Results buttons', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user, 2);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save results/i })).toBeInTheDocument();
      });
    }, 30000);

    it('allows retaking assessment', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user, 2);

      await waitFor(() => {
        expect(screen.getByText('Retake Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Retake Assessment'));

      expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument();
    }, 30000);
  });

  describe('Saving Results', () => {
    async function answerAllQuestions(user: ReturnType<typeof userEvent.setup>) {
      for (let i = 0; i < 15; i++) {
        const buttons = screen.getAllByRole('button').filter(
          (btn) =>
            !btn.textContent?.match(/Previous|Cancel/) &&
            btn.getAttribute('aria-label') !== 'Close' &&
            btn.textContent?.trim() !== '' // Filter out buttons with no text (like Close icon)
        );
        if (buttons[2]) {
          await user.click(buttons[2]); // Middle option
        }
      }
    }

    it('saves results to database and calls onComplete', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

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
      expect(savedResult.assessmentType).toBe('risk_tolerance');
      expect(savedResult.scores.profile).toBeDefined();
      expect(savedResult.scores.percentage).toBeDefined();
      expect(savedResult.scores.time_horizon).toBeDefined();
      expect(savedResult.scores.volatility).toBeDefined();
    }, 30000);

    it('shows saving state while processing', async () => {
      vi.mocked(assessments.add).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save results/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save results/i }));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    }, 30000);

    it('calls onCancel when Close is clicked in results', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllQuestions(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    }, 30000);
  });

  describe('Risk Profile Thresholds', () => {
    async function answerWithScore(user: ReturnType<typeof userEvent.setup>, optionIndex: number) {
      for (let i = 0; i < 15; i++) {
        const buttons = screen.getAllByRole('button').filter(
          (btn) =>
            !btn.textContent?.match(/Previous|Cancel/) &&
            btn.getAttribute('aria-label') !== 'Close' &&
            btn.textContent?.trim() !== '' // Filter out buttons with no text (like Close icon)
        );
        if (buttons[optionIndex]) {
          await user.click(buttons[optionIndex]);
        }
      }
    }

    it('categorizes as conservative for lowest scores', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerWithScore(user, 0);

      await waitFor(() => {
        // Conservative appears in profile title and risk spectrum, use getAllByText
        const conservativeElements = screen.getAllByText('Conservative');
        expect(conservativeElements.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/20% Stocks.*70% Bonds/)).toBeInTheDocument();
      });
    }, 30000);

    it('categorizes as aggressive for highest scores', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerWithScore(user, 4);

      await waitFor(() => {
        // Aggressive appears in profile title and risk spectrum, use getAllByText
        const aggressiveElements = screen.getAllByText('Aggressive');
        expect(aggressiveElements.length).toBeGreaterThanOrEqual(2); // Title + spectrum label
        expect(screen.getByText(/90% Stocks.*10% Bonds/)).toBeInTheDocument();
      });
    }, 30000);
  });

  describe('Question Categories', () => {
    it('shows different category tags for different questions', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // First question - Time Horizon
      expect(screen.getByText('Time Horizon')).toBeInTheDocument();

      // Answer first 3 questions to get to Volatility section
      for (let i = 0; i < 3; i++) {
        const buttons = screen.getAllByRole('button').filter(
          (btn) =>
            !btn.textContent?.match(/Previous|Cancel/) &&
            btn.getAttribute('aria-label') !== 'Close' &&
            btn.textContent?.trim() !== ''
        );
        await user.click(buttons[2]);
      }

      // Fourth question - Volatility Tolerance
      expect(screen.getByText('Volatility Tolerance')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible close button', () => {
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('answer options are keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Tab to first option and press Enter
      await user.tab();
      await user.tab();
      await user.tab(); // Skip to options
      await user.keyboard('{Enter}');

      // Should advance to next question
      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument();
      });
    });
  });
});
