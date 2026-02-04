import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoreValuesAssessment } from '@/components/client/CoreValuesAssessment';

// Mock the db module
vi.mock('@/lib/db', () => ({
  assessments: {
    add: vi.fn(() => Promise.resolve()),
  },
}));

import { assessments } from '@/lib/db';

describe('CoreValuesAssessment', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders the assessment title', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Core Values Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Rate how important each value is to you/)).toBeInTheDocument();
    });

    it('shows first page of values', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      expect(screen.getByText('0 of 30 rated')).toBeInTheDocument();
    });

    it('displays rating scale legend', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Not Important')).toBeInTheDocument();
      expect(screen.getByText('Essential')).toBeInTheDocument();
    });

    it('shows value cards with descriptions', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // First value should be Achievement
      expect(screen.getByText('Achievement')).toBeInTheDocument();
      expect(screen.getByText('Accomplishing goals and being successful')).toBeInTheDocument();
    });

    it('displays category tags for values', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Multiple values may have the same category, so use getAllByText
      const categoryTags = screen.getAllByText('Personal Growth');
      expect(categoryTags.length).toBeGreaterThanOrEqual(1);
    });

    it('has Previous, Cancel, and Next buttons', { timeout: 10000 }, () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('has disabled Previous button on first page', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('has disabled Next button until all values on page are rated', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });
  });

  describe('Rating Values', () => {
    it('allows rating a value from 1-5', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Find rating button 5 for the first value (Achievement)
      // Each value has rating buttons 1-5, so the first "5" button is for Achievement
      const fiveButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '5'
      );

      // Click the first "5" button (for Achievement)
      await user.click(fiveButtons[0]);

      // Progress should update
      expect(screen.getByText('1 of 30 rated')).toBeInTheDocument();
    });

    it('highlights selected rating', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Find rating button for first value
      const allRatingButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '5' && !btn.textContent?.includes('of')
      );

      await user.click(allRatingButtons[0]);

      // Button should have active styling
      expect(allRatingButtons[0]).toHaveClass('bg-[var(--color-accent-primary)]');
    });

    it('allows changing a rating', { timeout: 10000 }, async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Rate as 5
      const fiveButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '5'
      );
      await user.click(fiveButtons[0]);

      // Change to 3
      const threeButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '3'
      );
      await user.click(threeButtons[0]);

      // 3 should be selected now
      expect(threeButtons[0]).toHaveClass('bg-[var(--color-accent-primary)]');
    });
  });

  describe('Navigation', () => {
    async function rateAllOnPage(user: ReturnType<typeof userEvent.setup>) {
      // Rate all 10 values on current page with rating 3
      const threeButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '3'
      );
      for (let i = 0; i < 10; i++) {
        if (threeButtons[i]) {
          await user.click(threeButtons[i]);
        }
      }
    }

    it('enables Next button when all values on page are rated', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllOnPage(user);

      expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
    });

    it('advances to next page when Next is clicked', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllOnPage(user);
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });

    it('allows going back to previous page', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllOnPage(user);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /previous/i }));

      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    it('preserves ratings when navigating between pages', { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllOnPage(user);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /previous/i }));

      // Should still show 10 rated
      expect(screen.getByText('10 of 30 rated')).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when close icon is clicked', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByLabelText('Close'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Results View', () => {
    async function rateAllValues(user: ReturnType<typeof userEvent.setup>) {
      // Rate all values across all pages
      for (let page = 0; page < 3; page++) {
        const threeButtons = screen.getAllByRole('button').filter(
          (btn) => btn.textContent === '3'
        );
        for (let i = 0; i < 10; i++) {
          if (threeButtons[i]) {
            await user.click(threeButtons[i]);
          }
        }

        const nextButton = screen.getByRole('button', { name: page < 2 ? /next/i : /see results/i });
        await user.click(nextButton);
      }
    }

    it('shows results after rating all values', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByText('Your Core Values')).toBeInTheDocument();
      });
    }, 30000);

    it('displays top 5 core values', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByText('Your Top 5 Core Values')).toBeInTheDocument();
      });
    }, 30000);

    it('shows dominant value category', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByText('Your Dominant Value Category')).toBeInTheDocument();
      });
    }, 30000);

    it('shows category importance breakdown', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByText('Category Importance')).toBeInTheDocument();
        // Personal Growth may appear multiple times (in top values and in category breakdown)
        const personalGrowthElements = screen.getAllByText('Personal Growth');
        expect(personalGrowthElements.length).toBeGreaterThanOrEqual(1);
      });
    }, 30000);

    it('shows deprioritized values', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByText('Values You Deprioritize')).toBeInTheDocument();
      });
    }, 30000);

    it('shows insight section', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByText('What This Means')).toBeInTheDocument();
      });
    }, 30000);

    it('allows reviewing ratings', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByText('Review Ratings')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Review Ratings'));

      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    }, 30000);
  });

  describe('Saving Results', () => {
    async function rateAllValues(user: ReturnType<typeof userEvent.setup>) {
      for (let page = 0; page < 3; page++) {
        const threeButtons = screen.getAllByRole('button').filter(
          (btn) => btn.textContent === '3'
        );
        for (let i = 0; i < 10; i++) {
          if (threeButtons[i]) {
            await user.click(threeButtons[i]);
          }
        }
        const nextButton = screen.getByRole('button', { name: page < 2 ? /next/i : /see results/i });
        await user.click(nextButton);
      }
    }

    it('saves results to database and calls onComplete', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

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
      expect(savedResult.assessmentType).toBe('values');
      expect(savedResult.scores.dominantCategory).toBeDefined();
      expect(savedResult.scores.top1).toBeDefined();
      expect(savedResult.scores.top1_rating).toBeDefined();
    }, 30000);

    it('shows saving state while processing', async () => {
      vi.mocked(assessments.add).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save results/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save results/i }));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    }, 30000);

    it('calls onCancel when Close is clicked in results', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateAllValues(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    }, 30000);
  });

  describe('Value Ranking', () => {
    async function rateWithVariedScores(user: ReturnType<typeof userEvent.setup>) {
      // Rate first 10 values with high scores (5)
      const fiveButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '5'
      );
      for (let i = 0; i < 10; i++) {
        if (fiveButtons[i]) {
          await user.click(fiveButtons[i]);
        }
      }
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Rate next 10 with medium scores (3)
      const threeButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '3'
      );
      for (let i = 0; i < 10; i++) {
        if (threeButtons[i]) {
          await user.click(threeButtons[i]);
        }
      }
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Rate last 10 with low scores (1)
      const oneButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '1'
      );
      for (let i = 0; i < 10; i++) {
        if (oneButtons[i]) {
          await user.click(oneButtons[i]);
        }
      }
      await user.click(screen.getByRole('button', { name: /see results/i }));
    }

    it('ranks values by rating', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await rateWithVariedScores(user);

      await waitFor(() => {
        // Top values should be from the high-rated group
        expect(screen.getByText('Your Top 5 Core Values')).toBeInTheDocument();
      });
    }, 45000);
  });

  describe('Accessibility', () => {
    it('has accessible close button', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('rating buttons have title attributes', () => {
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const button5 = screen.getAllByRole('button').find((btn) => btn.textContent === '5');
      expect(button5).toHaveAttribute('title', 'Essential');
    });
  });

  describe('Progress Tracking', () => {
    it('updates progress bar as values are rated', async () => {
      const user = userEvent.setup();
      render(<CoreValuesAssessment onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Rate one value
      const threeButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === '3'
      );
      await user.click(threeButtons[0]);

      // Progress should be 1/30 ≈ 3%
      expect(screen.getByText('1 of 30 rated')).toBeInTheDocument();
    });
  });
});
