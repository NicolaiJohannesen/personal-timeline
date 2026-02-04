import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIRECalculator } from '@/components/client/FIRECalculator';

// Mock the db module
vi.mock('@/lib/db', () => ({
  assessments: {
    add: vi.fn(() => Promise.resolve()),
  },
}));

import { assessments } from '@/lib/db';

describe('FIRECalculator', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders the calculator form', () => {
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
      expect(screen.getByText(/Calculate your path to Financial Independence/)).toBeInTheDocument();
    });

    it('displays all input sections', () => {
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Personal Info')).toBeInTheDocument();
      expect(screen.getByText('Income & Expenses')).toBeInTheDocument();
      expect(screen.getByText('Current Savings')).toBeInTheDocument();
      expect(screen.getByText('Assumptions')).toBeInTheDocument();
    });

    it('has default input values', () => {
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // Current age
      expect(screen.getByDisplayValue('50')).toBeInTheDocument(); // Target retirement age
      expect(screen.getByDisplayValue('80000')).toBeInTheDocument(); // Annual income
      // Both annual expenses and current savings default to 50000
      const inputs50000 = screen.getAllByDisplayValue('50000');
      expect(inputs50000.length).toBeGreaterThanOrEqual(1);
    });

    it('shows quick preview with FIRE number', () => {
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Quick Preview')).toBeInTheDocument();
      // Default FIRE number = 50000 / 0.04 = 1,250,000
      expect(screen.getByText(/FIRE Number: \$1,250,000/)).toBeInTheDocument();
    });

    it('shows Cancel and Calculate buttons', () => {
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /calculate projection/i })).toBeInTheDocument();
    });
  });

  describe('Input Changes', () => {
    it('updates FIRE number when annual expenses change', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Find the annual expenses input and change it
      const expensesInputs = screen.getAllByDisplayValue('50000');
      const expensesInput = expensesInputs[0]; // First one is annual expenses

      await user.clear(expensesInput);
      await user.type(expensesInput, '40000');

      // FIRE number should now be 40000 / 0.04 = 1,000,000
      await waitFor(() => {
        expect(screen.getByText(/FIRE Number: \$1,000,000/)).toBeInTheDocument();
      });
    });

    it('updates savings rate when income or expenses change', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Default: 80000 income, 50000 expenses = 37.5% savings rate
      expect(screen.getByText('37.5%')).toBeInTheDocument();

      // Change income to 100000
      const incomeInput = screen.getByDisplayValue('80000');
      await user.clear(incomeInput);
      await user.type(incomeInput, '100000');

      // New savings rate: (100000 - 50000) / 100000 = 50%
      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    it('allows changing current age', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const ageInput = screen.getByDisplayValue('30');
      await user.clear(ageInput);
      await user.type(ageInput, '25');

      expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    });

    it('allows changing withdrawal rate', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Use fireEvent for number inputs to avoid React controlled input issues with decimals
      const withdrawalInput = screen.getByDisplayValue('4');
      fireEvent.change(withdrawalInput, { target: { value: '3.5' } });

      // FIRE number changes with withdrawal rate: 50000 / 0.035 ≈ 1,428,571
      await waitFor(() => {
        expect(screen.getByText(/FIRE Number: \$1,428,571/)).toBeInTheDocument();
      });
    });
  });

  describe('Results View', () => {
    it('shows results when Calculate button is clicked', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByText('Your FIRE Projection')).toBeInTheDocument();
      expect(screen.getByText('Your FIRE Number')).toBeInTheDocument();
    });

    it('displays progress bar', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByText('Progress to FIRE')).toBeInTheDocument();
    });

    it('shows key metrics grid', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByText('Years to FIRE')).toBeInTheDocument();
      expect(screen.getByText('Current Savings Rate')).toBeInTheDocument();
      expect(screen.getByText('Monthly Savings Needed')).toBeInTheDocument();
      expect(screen.getByText('Projected at Target Age')).toBeInTheDocument();
    });

    it('allows returning to edit inputs', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByText('Edit inputs'));

      expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
      expect(screen.getByText('Personal Info')).toBeInTheDocument();
    });

    it('shows Close and Save Results buttons', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save results/i })).toBeInTheDocument();
    });
  });

  describe('Saving Results', () => {
    it('saves results to database and calls onComplete', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByRole('button', { name: /save results/i }));

      await waitFor(() => {
        expect(assessments.add).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled();
      });

      // Verify the saved result structure
      const savedResult = vi.mocked(assessments.add).mock.calls[0][0];
      expect(savedResult.assessmentType).toBe('fire_projection');
      expect(savedResult.scores.fireNumber).toBeDefined();
      expect(savedResult.scores.yearsToFIRE).toBeDefined();
      expect(savedResult.scores.currentSavingsRate).toBeDefined();
    });

    it('shows saving state while processing', async () => {
      vi.mocked(assessments.add).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByRole('button', { name: /save results/i }));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when Cancel button is clicked in form view', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Close button is clicked in results view', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));
      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when close icon is clicked', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByLabelText('Close'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('FIRE Calculations', () => {
    it('calculates correct FIRE number (25x expenses at 4% withdrawal)', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Set expenses to 40000, withdrawal rate to 4%
      const expensesInputs = screen.getAllByDisplayValue('50000');
      await user.clear(expensesInputs[0]);
      await user.type(expensesInputs[0], '40000');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // FIRE number = 40000 / 0.04 = 1,000,000
      // May appear in multiple places (summary and breakdown)
      const fireNumberElements = screen.getAllByText('$1,000,000');
      expect(fireNumberElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows on-track message when projected savings exceed FIRE number', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Increase current savings significantly
      const savingsInputs = screen.getAllByDisplayValue('50000');
      const savingsInput = savingsInputs[1]; // Second is current savings
      await user.clear(savingsInput);
      await user.type(savingsInput, '500000');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByText("You're on track!")).toBeInTheDocument();
    });

    it('shows adjustment needed message when below target', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Set low savings and high expenses
      const savingsInputs = screen.getAllByDisplayValue('50000');
      await user.clear(savingsInputs[1]); // current savings
      await user.type(savingsInputs[1], '10000');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      expect(screen.getByText('Adjustment needed')).toBeInTheDocument();
    });

    it('handles zero income gracefully', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const incomeInput = screen.getByDisplayValue('80000');
      await user.clear(incomeInput);
      await user.type(incomeInput, '0');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // Should show 0% savings rate
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles expenses exceeding income', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Set expenses higher than income
      const expensesInputs = screen.getAllByDisplayValue('50000');
      await user.clear(expensesInputs[0]);
      await user.type(expensesInputs[0], '100000');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // Should show infinity for years to FIRE
      expect(screen.getByText('∞')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles already reached FIRE number', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Set current savings above FIRE number
      const savingsInputs = screen.getAllByDisplayValue('50000');
      await user.clear(savingsInputs[1]); // current savings
      await user.type(savingsInputs[1], '2000000');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // Years to FIRE should be 0
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('caps progress percentage at 100%', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Set current savings well above FIRE number
      const savingsInputs = screen.getAllByDisplayValue('50000');
      await user.clear(savingsInputs[1]);
      await user.type(savingsInputs[1], '5000000');

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // Progress should be capped at 100%
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible close button', () => {
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('all inputs have labels', () => {
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Current Age')).toBeInTheDocument();
      expect(screen.getByText('Target Retirement Age')).toBeInTheDocument();
      expect(screen.getByText('Annual Income')).toBeInTheDocument();
      expect(screen.getByText('Annual Expenses')).toBeInTheDocument();
      expect(screen.getByText('Total Invested Assets')).toBeInTheDocument();
      expect(screen.getByText('Expected Return')).toBeInTheDocument();
      expect(screen.getByText('Withdrawal Rate')).toBeInTheDocument();
      expect(screen.getByText('Inflation Rate')).toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('formats large numbers with commas', async () => {
      const user = userEvent.setup();
      render(<FIRECalculator onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /calculate projection/i }));

      // Default FIRE number should be formatted
      // May appear in multiple places (summary and breakdown)
      const fireNumberElements = screen.getAllByText('$1,250,000');
      expect(fireNumberElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
