import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentsView } from '@/components/client/AssessmentsView';
import type { AssessmentResult } from '@/types';

// Mock results for different assessment types
const mockBig5Result: AssessmentResult = {
  id: 'result-big5',
  userId: 'default-user',
  assessmentType: 'personality_big5',
  completedAt: new Date('2024-03-15'),
  duration: 900,
  scores: {
    openness: 75,
    conscientiousness: 60,
    extraversion: 45,
    agreeableness: 80,
    neuroticism: 30,
  },
};

const mockFIREResult: AssessmentResult = {
  id: 'result-fire',
  userId: 'default-user',
  assessmentType: 'fire_projection',
  completedAt: new Date('2024-03-16'),
  duration: 300,
  scores: {
    fireNumber: 1250000,
    yearsToFIRE: 15,
    currentSavingsRate: 37.5,
    progressPercentage: 4,
  },
};

const mockRiskResult: AssessmentResult = {
  id: 'result-risk',
  userId: 'default-user',
  assessmentType: 'risk_tolerance',
  completedAt: new Date('2024-03-17'),
  duration: 600,
  scores: {
    profile: 'moderate',
    percentage: 55,
    volatility: 60,
    time_horizon: 70,
    experience: 50,
  },
};

const mockValuesResult: AssessmentResult = {
  id: 'result-values',
  userId: 'default-user',
  assessmentType: 'values',
  completedAt: new Date('2024-03-18'),
  duration: 1200,
  scores: {
    dominantCategory: 'personal',
    top1: 'Growth',
    top1_rating: 5,
    top2: 'Freedom',
    top2_rating: 5,
    top3: 'Creativity',
    top3_rating: 5,
    top4: 'Health',
    top4_rating: 4,
    top5: 'Authenticity',
    top5_rating: 4,
  },
};

const mockIQResult: AssessmentResult = {
  id: 'result-iq',
  userId: 'default-user',
  assessmentType: 'iq',
  completedAt: new Date('2024-03-19'),
  duration: 1800,
  scores: {
    iqEstimate: 115,
    percentile: 84,
    accuracy: 77,
    correct: 23,
    total: 30,
    pattern_accuracy: 88,
    verbal_accuracy: 75,
    numerical_accuracy: 63,
    spatial_accuracy: 83,
  },
};

// Mock the database
vi.mock('@/lib/db', () => ({
  assessments: {
    getAll: vi.fn(),
    add: vi.fn(),
  },
}));

import { assessments } from '@/lib/db';

describe('AssessmentsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assessments.getAll).mockResolvedValue([]);
    vi.mocked(assessments.add).mockResolvedValue(mockBig5Result);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Page Structure', () => {
    it('renders page header', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
      });

      expect(screen.getByText(/Understand yourself better/i)).toBeInTheDocument();
    });

    it('renders all assessment cards', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Big Five Personality')).toBeInTheDocument();
      });

      expect(screen.getByText('MBTI Personality Type')).toBeInTheDocument();
      expect(screen.getByText('Cognitive Assessment')).toBeInTheDocument();
      expect(screen.getByText('Risk Tolerance')).toBeInTheDocument();
      expect(screen.getByText('Core Values')).toBeInTheDocument();
      expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
    });

    it('shows duration for each assessment', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('~15 minutes')).toBeInTheDocument(); // Big Five
      });

      // ~20 minutes is used by multiple assessments (Cognitive & Core Values)
      const twentyMinElements = screen.getAllByText('~20 minutes');
      expect(twentyMinElements.length).toBeGreaterThanOrEqual(1);
      // ~10 minutes is used by multiple assessments (MBTI & Risk Tolerance)
      const tenMinElements = screen.getAllByText('~10 minutes');
      expect(tenMinElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('~5 minutes')).toBeInTheDocument(); // FIRE
    });

    it('shows Your Results section', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Your Results' })).toBeInTheDocument();
      });
    });
  });

  describe('Assessment Availability', () => {
    it('enables Big Five assessment button', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Assessment/i });
        expect(startButtons.length).toBeGreaterThanOrEqual(5); // All 5 main assessments
      });
    });

    it('enables FIRE Calculator button', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Assessment/i });
        // FIRE is the 5th card
        expect(startButtons[4]).not.toBeDisabled();
      });
    });

    it('enables Risk Tolerance button', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Assessment/i });
        // Risk is the 3rd card
        expect(startButtons[2]).not.toBeDisabled();
      });
    });

    it('enables Core Values button', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Assessment/i });
        // Values is the 4th card
        expect(startButtons[3]).not.toBeDisabled();
      });
    });

    it('enables Cognitive Assessment button', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Assessment/i });
        // Cognitive is the 2nd card
        expect(startButtons[1]).not.toBeDisabled();
      });
    });
  });

  describe('Starting Assessments', () => {
    it('shows Big Five assessment when Start clicked', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Big Five Personality')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[0]); // Big Five is first

      expect(screen.getByText('Big Five Personality Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Question 1 of 50/)).toBeInTheDocument();
    });

    it('shows FIRE Calculator when Start clicked', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[5]); // FIRE is 6th (after MBTI added)

      expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
      expect(screen.getByText('Personal Info')).toBeInTheDocument();
    });

    it('shows Risk Tolerance when Start clicked', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Risk Tolerance')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[3]); // Risk is 4th (after MBTI added)

      expect(screen.getByText('Risk Tolerance Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Question 1 of 15/)).toBeInTheDocument();
    });

    it('shows Core Values when Start clicked', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Core Values')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[4]); // Values is 5th (after MBTI added)

      expect(screen.getByText('Core Values Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    it('shows Cognitive Assessment when Start clicked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Cognitive Assessment')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[2]); // Cognitive is 3rd (after MBTI added)

      expect(screen.getByText('Cognitive Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Question 1 of 30/)).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Results Loading', () => {
    it('shows loading skeleton while fetching', () => {
      vi.mocked(assessments.getAll).mockImplementation(() => new Promise(() => {}));

      render(<AssessmentsView />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });

    it('shows empty state when no results', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/Complete an assessment to see your results here/i)).toBeInTheDocument();
      });
    });
  });

  describe('Big Five Results Display', () => {
    it('displays Big Five result card', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockBig5Result]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getAllByText('Big Five Personality').length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getByText(/Completed Mar 15, 2024/)).toBeInTheDocument();
    });

    it('shows trait scores for Big Five results', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockBig5Result]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument(); // Openness
        expect(screen.getByText('60%')).toBeInTheDocument(); // Conscientiousness
        expect(screen.getByText('45%')).toBeInTheDocument(); // Extraversion
        expect(screen.getByText('80%')).toBeInTheDocument(); // Agreeableness
        expect(screen.getByText('30%')).toBeInTheDocument(); // Neuroticism
      });
    });

    it('shows trait labels for Big Five results', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockBig5Result]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Openness')).toBeInTheDocument();
        expect(screen.getByText('Conscientiousness')).toBeInTheDocument();
        expect(screen.getByText('Extraversion')).toBeInTheDocument();
        expect(screen.getByText('Agreeableness')).toBeInTheDocument();
        expect(screen.getByText('Neuroticism')).toBeInTheDocument();
      });
    });

    it('formats duration correctly', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockBig5Result]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/15m 0s/)).toBeInTheDocument();
      });
    });
  });

  describe('FIRE Results Display', () => {
    it('displays FIRE result card', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockFIREResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getAllByText('FIRE Calculator').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows FIRE number', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockFIREResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('$1,250,000')).toBeInTheDocument();
        expect(screen.getByText('FIRE Number')).toBeInTheDocument();
      });
    });

    it('shows years to FIRE', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockFIREResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('Years to FIRE')).toBeInTheDocument();
      });
    });

    it('shows savings rate', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockFIREResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('37.5%')).toBeInTheDocument();
        expect(screen.getByText('Savings Rate')).toBeInTheDocument();
      });
    });

    it('shows progress percentage', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockFIREResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('4%')).toBeInTheDocument();
        expect(screen.getByText('Progress')).toBeInTheDocument();
      });
    });
  });

  describe('Risk Tolerance Results Display', () => {
    it('displays Risk Tolerance result card', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockRiskResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getAllByText('Risk Tolerance').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows risk profile', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockRiskResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('moderate')).toBeInTheDocument();
        expect(screen.getByText('Risk Profile')).toBeInTheDocument();
      });
    });

    it('shows risk score', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockRiskResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('55%')).toBeInTheDocument();
        expect(screen.getByText('Risk Score')).toBeInTheDocument();
      });
    });

    it('shows volatility tolerance', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockRiskResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('Volatility')).toBeInTheDocument();
      });
    });
  });

  describe('Core Values Results Display', () => {
    it('displays Core Values result card', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockValuesResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getAllByText('Core Values').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows top core values', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockValuesResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Top Core Values:')).toBeInTheDocument();
        expect(screen.getByText('Growth')).toBeInTheDocument();
        expect(screen.getByText('Freedom')).toBeInTheDocument();
        expect(screen.getByText('Creativity')).toBeInTheDocument();
      });
    });
  });

  describe('IQ Results Display', () => {
    it('displays Cognitive Assessment result card', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockIQResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getAllByText('Cognitive Assessment').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows IQ estimate', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockIQResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('115')).toBeInTheDocument();
        expect(screen.getByText('Est. IQ')).toBeInTheDocument();
      });
    });

    it('shows percentile', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockIQResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('84th')).toBeInTheDocument();
        expect(screen.getByText('Percentile')).toBeInTheDocument();
      });
    });

    it('shows accuracy', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockIQResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('77%')).toBeInTheDocument();
        expect(screen.getByText('Accuracy')).toBeInTheDocument();
      });
    });

    it('shows correct answers', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([mockIQResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('23/30')).toBeInTheDocument();
        expect(screen.getByText('Correct')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Results', () => {
    it('shows multiple results sorted by date (newest first)', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([
        mockBig5Result,
        mockFIREResult,
        mockRiskResult,
      ]);

      render(<AssessmentsView />);

      await waitFor(() => {
        // Should show multiple completion dates
        expect(screen.getByText(/Mar 15, 2024/)).toBeInTheDocument();
        expect(screen.getByText(/Mar 16, 2024/)).toBeInTheDocument();
        expect(screen.getByText(/Mar 17, 2024/)).toBeInTheDocument();
      });
    });

    it('shows all assessment types in results', async () => {
      vi.mocked(assessments.getAll).mockResolvedValue([
        mockBig5Result,
        mockFIREResult,
        mockRiskResult,
        mockValuesResult,
        mockIQResult,
      ]);

      render(<AssessmentsView />);

      await waitFor(() => {
        // Check for unique result displays
        expect(screen.getByText('Openness')).toBeInTheDocument(); // Big Five trait
        expect(screen.getByText('FIRE Number')).toBeInTheDocument(); // FIRE
        expect(screen.getByText('Risk Profile')).toBeInTheDocument(); // Risk
        expect(screen.getByText('Top Core Values:')).toBeInTheDocument(); // Values
        expect(screen.getByText('Est. IQ')).toBeInTheDocument(); // IQ
      });
    });
  });

  describe('Returning from Assessment', () => {
    it('returns to main view when Big Five cancelled', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Big Five Personality')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[0]);

      expect(screen.getByText('Big Five Personality Assessment')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Cancel assessment/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
      });
    });

    it('returns to main view when FIRE closed', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[5]); // FIRE is 6th (after MBTI added)

      expect(screen.getByText('Personal Info')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
      });
    });

    it('returns to main view when Risk Tolerance cancelled', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Risk Tolerance')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[3]); // Risk is 4th (after MBTI added)

      expect(screen.getByText('Risk Tolerance Assessment')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
      });
    });

    it('returns to main view when Core Values cancelled', async () => {
      const user = userEvent.setup();
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('Core Values')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Start Assessment/i });
      await user.click(buttons[4]);

      expect(screen.getByText('Core Values Assessment')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles database error gracefully', async () => {
      vi.mocked(assessments.getAll).mockRejectedValue(new Error('DB Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load assessment results:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Assessment Descriptions', () => {
    it('shows Big Five description', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/openness, conscientiousness, extraversion, agreeableness, and neuroticism/i)).toBeInTheDocument();
      });
    });

    it('shows Cognitive description', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/pattern recognition, verbal reasoning/i)).toBeInTheDocument();
      });
    });

    it('shows Risk Tolerance description', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/financial risk profile/i)).toBeInTheDocument();
      });
    });

    it('shows Core Values description', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/core values to guide life decisions/i)).toBeInTheDocument();
      });
    });

    it('shows FIRE description', async () => {
      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/Financial Independence and Early Retirement/i)).toBeInTheDocument();
      });
    });
  });

  describe('Duration Formatting', () => {
    it('formats seconds only', async () => {
      const result = { ...mockBig5Result, duration: 45 };
      vi.mocked(assessments.getAll).mockResolvedValue([result]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/45s/)).toBeInTheDocument();
      });
    });

    it('formats minutes and seconds', async () => {
      const result = { ...mockBig5Result, duration: 125 }; // 2m 5s
      vi.mocked(assessments.getAll).mockResolvedValue([result]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText(/2m 5s/)).toBeInTheDocument();
      });
    });
  });

  describe('FIRE Infinity Handling', () => {
    it('displays infinity symbol for infinite years to FIRE', async () => {
      const infiniteResult = {
        ...mockFIREResult,
        scores: {
          ...mockFIREResult.scores,
          yearsToFIRE: Infinity,
        },
      };
      vi.mocked(assessments.getAll).mockResolvedValue([infiniteResult]);

      render(<AssessmentsView />);

      await waitFor(() => {
        expect(screen.getByText('∞')).toBeInTheDocument();
      });
    });
  });
});
