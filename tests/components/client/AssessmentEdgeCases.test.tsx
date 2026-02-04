import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CognitiveAssessment } from '@/components/client/CognitiveAssessment';
import { FIRECalculator } from '@/components/client/FIRECalculator';
import { RiskToleranceAssessment } from '@/components/client/RiskToleranceAssessment';
import { CoreValuesAssessment } from '@/components/client/CoreValuesAssessment';

// Mock the db module
vi.mock('@/lib/db', () => ({
  assessments: {
    add: vi.fn(() => Promise.resolve()),
  },
}));

import { assessments } from '@/lib/db';

describe('Assessment Edge Cases', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CognitiveAssessment Edge Cases', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('handles clicking an answer option', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Click an option
      const option = screen.getByText('9');
      await user.click(option);

      // Should advance after the delay
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 30/)).toBeInTheDocument();
      });
    });

    it('handles timer reaching exactly 0', async () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Advance exactly to 0
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 30/)).toBeInTheDocument();
      });
    });

    it('tracks time taken per question for fast answers', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer immediately
      await user.click(screen.getByText('9'));

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Question should advance and continue tracking time
      expect(screen.getByText(/Question 2 of 30/)).toBeInTheDocument();
    });

    it('handles multiple timeouts in sequence', async () => {
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // First timeout - advance to question 2
      await act(async () => {
        vi.advanceTimersByTime(31000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 30/)).toBeInTheDocument();
      });

      // Second timeout - advance to question 3
      await act(async () => {
        vi.advanceTimersByTime(31000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Question 3 of 30/)).toBeInTheDocument();
      });
    });

    it('handles clicking option right before timeout', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Advance to 29 seconds
      await act(async () => {
        vi.advanceTimersByTime(29000);
      });

      // Click just before timeout
      await user.click(screen.getByText('9'));

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Should advance to question 2, not skip due to timeout
      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 30/)).toBeInTheDocument();
      });
    });

    it('calculates IQ correctly with perfect score', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<CognitiveAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer all questions correctly (first option for each)
      for (let i = 0; i < 30; i++) {
        const options = screen.getAllByRole('button').filter(
          (btn) =>
            btn.textContent?.startsWith('A.') ||
            btn.textContent?.startsWith('B.') ||
            btn.textContent?.startsWith('C.') ||
            btn.textContent?.startsWith('D.')
        );

        if (options.length > 0) {
          await user.click(options[0]); // Always click first option
        }

        await act(async () => {
          vi.advanceTimersByTime(600);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Estimated IQ Score')).toBeInTheDocument();
      });
    }, 60000);
  });

  describe('FIRECalculator Edge Cases', () => {
    it('handles very small withdrawal rate', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const withdrawalInput = screen.getByDisplayValue('4');
      await user.clear(withdrawalInput);
      await user.type(withdrawalInput, '0.5');

      // FIRE number should be very high: 50000 / 0.005 = 10,000,000
      await waitFor(() => {
        expect(screen.getByText(/FIRE Number: \$10,000,000/)).toBeInTheDocument();
      });
    });

    it('handles retirement age equal to current age', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const retirementInput = screen.getByDisplayValue('50');
      await user.clear(retirementInput);
      await user.type(retirementInput, '30');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // Should still show results
      expect(screen.getByText('Your FIRE Projection')).toBeInTheDocument();
    });

    it('handles very high return rate', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const returnInput = screen.getByDisplayValue('7');
      await user.clear(returnInput);
      await user.type(returnInput, '15');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByText('Your FIRE Projection')).toBeInTheDocument();
    });

    it('handles inflation higher than returns', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const returnInput = screen.getByDisplayValue('7');
      await user.clear(returnInput);
      await user.type(returnInput, '2');

      // Default inflation rate is 2.5
      const inflationInput = screen.getByDisplayValue('2.5');
      await user.clear(inflationInput);
      await user.type(inflationInput, '5');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByText('Your FIRE Projection')).toBeInTheDocument();
    });

    it('saves results with all edge case values', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Set edge case values
      const incomeInput = screen.getByDisplayValue('80000');
      await user.clear(incomeInput);
      await user.type(incomeInput, '1000000');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(assessments.add).toHaveBeenCalled();
      });
    });

    it('handles database save failure gracefully', async () => {
      vi.mocked(assessments.add).mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('maintains input values after editing and recalculating', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Calculate first time
      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // Go back to edit
      await user.click(screen.getByText('Edit inputs'));

      // Values should be preserved
      expect(screen.getByDisplayValue('80000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });
  });

  describe('RiskToleranceAssessment Edge Cases', () => {
    async function answerAllWithOption(
      user: ReturnType<typeof userEvent.setup>,
      optionIndex: number
    ) {
      for (let i = 0; i < 15; i++) {
        const buttons = screen
          .getAllByRole('button')
          .filter(
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

    it('handles rapidly changing answers on same question', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Click first option
      await user.click(screen.getByText('Less than 3 years'));

      // We should be on question 2 now
      expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument();

      // Go back and change answer
      await user.click(screen.getByRole('button', { name: /previous/i }));
      await user.click(screen.getByText('More than 20 years'));

      // Should advance again
      expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument();
    });

    it('handles navigation back and forth multiple times', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Answer first question
      await user.click(screen.getByText('Less than 3 years'));

      // Navigate back and forth
      await user.click(screen.getByRole('button', { name: /previous/i }));
      await user.click(screen.getByText('Less than 3 years'));
      await user.click(screen.getByRole('button', { name: /previous/i }));
      await user.click(screen.getByText('Less than 3 years'));

      // Should still be in a valid state
      expect(screen.getByText(/Question 2 of 15/)).toBeInTheDocument();
    });

    it('handles database save error gracefully', async () => {
      vi.mocked(assessments.add).mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await answerAllWithOption(user, 2);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save results/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    }, 30000);

    it('handles retake after completing', async () => {
      const user = userEvent.setup();
      render(<RiskToleranceAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Complete first time
      await answerAllWithOption(user, 0);

      await waitFor(() => {
        expect(screen.getByText('Retake Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Retake Assessment'));

      // Should start fresh
      expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument();

      // Complete again with different answers
      await answerAllWithOption(user, 4);

      await waitFor(() => {
        // Aggressive appears in profile title and risk spectrum
        const aggressiveElements = screen.getAllByText('Aggressive');
        expect(aggressiveElements.length).toBeGreaterThanOrEqual(2);
      });
    }, 60000);
  });

  describe('CoreValuesAssessment Edge Cases', () => {
    async function rateAllOnPage(user: ReturnType<typeof userEvent.setup>, rating: string) {
      const ratingButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent === rating);
      for (let i = 0; i < 10; i++) {
        if (ratingButtons[i]) {
          await user.click(ratingButtons[i]);
        }
      }
    }

    it('handles re-rating values on same page', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Rate first value as 5
      const fiveButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '5');
      await user.click(fiveButtons[0]);

      expect(screen.getByText('1 of 30 rated')).toBeInTheDocument();

      // Change to 1
      const oneButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '1');
      await user.click(oneButtons[0]);

      // Count should still be 1, not 2
      expect(screen.getByText('1 of 30 rated')).toBeInTheDocument();
    });

    it('handles navigation after partial page completion', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Rate only 5 values on page 1
      const threeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent === '3');
      for (let i = 0; i < 5; i++) {
        await user.click(threeButtons[i]);
      }

      expect(screen.getByText('5 of 30 rated')).toBeInTheDocument();

      // Next should still be disabled
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('preserves ratings across page navigation', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Rate all on page 1 with 5s
      await rateAllOnPage(user, '5');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Rate all on page 2 with 3s
      await rateAllOnPage(user, '3');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Go back to page 1
      await user.click(screen.getByRole('button', { name: /previous/i }));
      await user.click(screen.getByRole('button', { name: /previous/i }));

      // Ratings should be preserved
      const selectedFives = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '5' && btn.classList.contains('bg-[var(--color-accent-primary)]')
      );
      expect(selectedFives.length).toBeGreaterThan(0);
    });

    it('handles database save error gracefully', async () => {
      vi.mocked(assessments.add).mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Complete all pages
      for (let page = 0; page < 3; page++) {
        await rateAllOnPage(user, '3');
        const nextButton = screen.getByRole('button', {
          name: page < 2 ? /next/i : /see results/i,
        });
        await user.click(nextButton);
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save results/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    }, 30000);

    it('calculates varied scores correctly', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Page 1: Rate as 5
      await rateAllOnPage(user, '5');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Page 2: Rate as 3
      await rateAllOnPage(user, '3');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Page 3: Rate as 1
      await rateAllOnPage(user, '1');
      await user.click(screen.getByRole('button', { name: /see results/i }));

      await waitFor(() => {
        expect(screen.getByText('Your Top 5 Core Values')).toBeInTheDocument();
        // Should have values deprioritized (rated 1)
        expect(screen.getByText('Values You Deprioritize')).toBeInTheDocument();
      });
    }, 30000);
  });

  describe('Cross-Assessment Edge Cases', () => {
    it('handles multiple assessments completing with same mock', async () => {
      // Verify mock is properly cleared between tests
      expect(assessments.add).not.toHaveBeenCalled();

      // Complete a simple FIRE calculation
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(assessments.add).toHaveBeenCalledTimes(1);
      });

      const savedResult = vi.mocked(assessments.add).mock.calls[0][0];
      expect(savedResult.assessmentType).toBe('fire_projection');
    });
  });
});
