import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoachView } from '@/components/client/CoachView';
import type { TimelineEvent, Goal, UserProfile, AssessmentResult } from '@/types';

// Mock scrollIntoView which isn't available in JSDOM
Element.prototype.scrollIntoView = vi.fn();

// Mock the database modules
vi.mock('@/lib/db', () => ({
  timelineEvents: {
    getAll: vi.fn(),
  },
  userProfile: {
    get: vi.fn(),
  },
  goals: {
    getAll: vi.fn(),
  },
  assessments: {
    getAll: vi.fn(),
  },
}));

// Mock the asyncCleanup utility
vi.mock('@/lib/utils/asyncCleanup', () => ({
  createAbortController: vi.fn(() => {
    let aborted = false;
    return {
      isAborted: () => aborted,
      cleanup: () => { aborted = true; },
    };
  }),
}));

import { timelineEvents, userProfile, goals, assessments } from '@/lib/db';

// Sample test data
const mockProfile: UserProfile = {
  id: 'user-1',
  name: 'Test User',
  birthDate: new Date('1990-01-15'),
  country: 'Denmark',
  lifeExpectancy: 80,
  createdAt: new Date(),
  updatedAt: new Date(),
  settings: {
    theme: 'dark',
    defaultView: 'timeline',
    sidebarCollapsed: false,
    notifications: {
      goalReminders: true,
      milestoneAlerts: true,
      coachingPrompts: true,
    },
  },
};

const mockGoals: Goal[] = [
  {
    id: 'goal-1',
    userId: 'user-1',
    title: 'Learn Spanish',
    description: 'Become conversational in Spanish',
    category: 'personal',
    targetDate: new Date('2025-12-31'),
    priority: 'high',
    status: 'in_progress',
    milestones: [
      { id: 'm1', title: 'Complete basics', completed: true },
      { id: 'm2', title: 'Watch a movie', completed: false },
    ],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'goal-2',
    userId: 'user-1',
    title: 'Run a marathon',
    category: 'health',
    priority: 'medium',
    status: 'not_started',
    milestones: [],
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockEvents: TimelineEvent[] = [
  {
    id: 'event-1',
    userId: 'user-1',
    title: 'Started new job',
    startDate: new Date('2024-01-15'),
    layer: 'work',
    eventType: 'career_change',
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'event-2',
    userId: 'user-1',
    title: 'Visited Paris',
    startDate: new Date('2024-03-10'),
    layer: 'travel',
    eventType: 'trip',
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'event-3',
    userId: 'user-1',
    title: 'Promotion',
    startDate: new Date('2024-06-01'),
    layer: 'work',
    eventType: 'promotion',
    source: 'linkedin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockAssessments: AssessmentResult[] = [
  {
    id: 'assessment-1',
    userId: 'user-1',
    assessmentType: 'personality_big5',
    completedAt: new Date(),
    scores: {
      openness: 75,
      conscientiousness: 80,
      extraversion: 60,
      agreeableness: 70,
      neuroticism: 35,
    },
    duration: 600,
  },
];

describe('CoachView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations returning empty data
    (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (userProfile.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (assessments.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('shows loading skeleton initially', () => {
      // Delay resolution to keep loading state visible
      (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<CoachView />);

      // Check for loading skeleton elements
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('hides loading state after data loads', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'AI Coach' })).toBeInTheDocument();
      });

      expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
  });

  describe('Welcome Message', () => {
    it('displays personalized welcome with user name', async () => {
      (userProfile.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome, Test User!/)).toBeInTheDocument();
      });
    });

    it('displays generic welcome without profile', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome!/)).toBeInTheDocument();
      });
    });

    it('mentions events and goals in welcome message when available', async () => {
      (userProfile.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);
      (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText(/3 timeline events/)).toBeInTheDocument();
        expect(screen.getByText(/2 active goals/)).toBeInTheDocument();
      });
    });

    it('shows coaching capabilities in welcome message', async () => {
      render(<CoachView />);

      await waitFor(() => {
        // Welcome message contains the coaching capabilities as bold text
        const strongElements = document.querySelectorAll('strong');
        const texts = Array.from(strongElements).map(el => el.textContent);
        expect(texts).toContain('Goal Progress');
        expect(texts).toContain('Life Patterns');
        expect(texts).toContain('Mental Wellness');
        expect(texts).toContain('Career Guidance');
      });
    });
  });

  describe('Message Sending', () => {
    it('sends message when clicking send button', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello there');

      // Find the send button (it's after the input)
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(btn => btn.classList.contains('btn-primary'));
      await user.click(sendButton!);

      await waitFor(() => {
        expect(screen.getByText('Hello there')).toBeInTheDocument();
      });
    });

    it('sends message when pressing Enter', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Test message{enter}');

      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('clears input after sending message', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...') as HTMLInputElement;
      await user.type(input, 'Test message{enter}');

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('disables input while AI is typing', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...') as HTMLInputElement;
      await user.type(input, 'Hello{enter}');

      // Input should be disabled while AI is "typing"
      await waitFor(() => {
        expect(input.disabled).toBe(true);
      });

      // Advance timers to complete the response
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(input.disabled).toBe(false);
    });

    it('shows typing indicator while AI is responding', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello{enter}');

      // Check for typing indicator (animated dots)
      await waitFor(() => {
        const bouncingDots = document.querySelectorAll('.animate-bounce');
        expect(bouncingDots.length).toBe(3);
      });

      // Complete the response
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Typing indicator should be gone
      const bouncingDots = document.querySelectorAll('.animate-bounce');
      expect(bouncingDots.length).toBe(0);
    });

    it('does not send empty messages', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, '   ');

      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(btn => btn.classList.contains('btn-primary'));

      // Send button should be disabled with empty/whitespace input
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Mock Response Generation', () => {
    it('responds to goal-related queries', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'How is my goal progress?{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        // Response mentions the goal and milestone progress
        expect(screen.getByText(/1 of 2 milestones/)).toBeInTheDocument();
      });
    });

    it('responds to timeline/pattern queries', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'What patterns do you see in my timeline?{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        // The response mentions the dominant layer
        expect(screen.getByText(/work layer.*2 events/)).toBeInTheDocument();
      });
    });

    it('responds to mood/wellness queries', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'I feel stressed lately{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/emotions are data/)).toBeInTheDocument();
      });
    });

    it('responds to career queries with work events', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Tell me about my career{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/2 work-related events/)).toBeInTheDocument();
      });
    });

    it('responds to career queries without work events', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'What about my job prospects?{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/career aspirations/)).toBeInTheDocument();
      });
    });

    it('responds to assessment queries with completed assessments', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (assessments.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssessments);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'What do my assessment results say?{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/completed 1 assessment/)).toBeInTheDocument();
      });
    });

    it('responds to assessment queries without assessments', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'What about my personality test?{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/recommend taking some of our assessments/)).toBeInTheDocument();
      });
    });

    it('responds to help/greeting queries', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'help{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // The help response includes these bullet points
      await waitFor(() => {
        const messageContainers = document.querySelectorAll('.whitespace-pre-wrap');
        const allText = Array.from(messageContainers).map(el => el.textContent).join(' ');
        expect(allText).toContain('Goal Progress');
      });
    });

    it('uses personalized response with profile name for default queries', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (userProfile.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Random question xyz123{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        const messageContainers = document.querySelectorAll('.whitespace-pre-wrap');
        const allText = Array.from(messageContainers).map(el => el.textContent).join(' ');
        expect(allText).toContain('Test User');
      });
    });

    it('gives default response for unrecognized queries without profile', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Random unrelated text xyz123{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/interesting thought/)).toBeInTheDocument();
      });
    });
  });

  describe('Coaching Focus Toggles', () => {
    it('shows all coaching focus checkboxes', async () => {
      render(<CoachView />);

      await waitFor(() => {
        // Check for checkboxes - there should be 4 (one for each focus area)
        expect(screen.getAllByRole('checkbox').length).toBe(4);
      });

      // Check labels are present (may appear multiple times in document)
      expect(screen.getAllByText('Goal Progress').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Life Patterns').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Mental Wellness').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Career Guidance').length).toBeGreaterThan(0);
    });

    it('has Goal Progress and Life Patterns checked by default', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // Goal Progress
      expect(checkboxes[1]).toBeChecked(); // Life Patterns
      expect(checkboxes[2]).not.toBeChecked(); // Mental Wellness
      expect(checkboxes[3]).not.toBeChecked(); // Career Guidance
    });

    it('toggles coaching focus when clicking checkbox', async () => {
      const user = userEvent.setup();

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      });

      const checkboxes = screen.getAllByRole('checkbox');

      // Toggle Mental Wellness on
      await user.click(checkboxes[2]);
      expect(checkboxes[2]).toBeChecked();

      // Toggle Goal Progress off
      await user.click(checkboxes[0]);
      expect(checkboxes[0]).not.toBeChecked();
    });
  });

  describe('Suggested Prompts', () => {
    it('shows suggested prompts when few messages exist', async () => {
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);
      (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Learn Spanish/ })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /patterns/ })).toBeInTheDocument();
    });

    it('shows "review goals" prompt when no active in_progress goal', async () => {
      const notStartedGoals: Goal[] = [{
        ...mockGoals[0],
        status: 'not_started',
      }];
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(notStartedGoals);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /review my goals/ })).toBeInTheDocument();
      });
    });

    it('shows default prompt when no focus is selected', async () => {
      const user = userEvent.setup();

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      });

      // Uncheck all focus options
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // Goal Progress off
      await user.click(checkboxes[1]); // Life Patterns off

      expect(screen.getByRole('button', { name: /What can you help me with/ })).toBeInTheDocument();
    });

    it('shows mood check-in prompt when mental wellness is selected', async () => {
      const user = userEvent.setup();

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[2]); // Mental Wellness on

      expect(screen.getByRole('button', { name: /mood check-in/ })).toBeInTheDocument();
    });

    it('shows career prompt when career guidance is selected', async () => {
      const user = userEvent.setup();

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[3]); // Career Guidance on

      expect(screen.getByRole('button', { name: /career next steps/ })).toBeInTheDocument();
    });

    it('fills input when clicking suggested prompt', async () => {
      const user = userEvent.setup();
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Learn Spanish/ })).toBeInTheDocument();
      });

      const promptButton = screen.getByRole('button', { name: /Learn Spanish/ });
      await user.click(promptButton);

      const input = screen.getByPlaceholderText('Type your message...') as HTMLInputElement;
      expect(input.value).toContain('Learn Spanish');
    });
  });

  describe('Context Sidebar', () => {
    it('displays timeline events count', async () => {
      (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText('Timeline Events')).toBeInTheDocument();
      });

      // Find the value next to Timeline Events
      const contextSection = screen.getByText('Your Context').closest('div');
      expect(contextSection).toHaveTextContent('3');
    });

    it('displays active goals count', async () => {
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);

      render(<CoachView />);

      await waitFor(() => {
        // Find "Active Goals" in the context section (not the preview header)
        expect(screen.getAllByText('Active Goals').length).toBeGreaterThan(0);
      });

      // Both goals are active (in_progress and not_started)
      const contextSection = screen.getByText('Your Context').closest('div');
      expect(contextSection).toHaveTextContent('2');
    });

    it('displays assessments count', async () => {
      (assessments.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssessments);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText('Assessments')).toBeInTheDocument();
      });

      const contextSection = screen.getByText('Your Context').closest('div');
      expect(contextSection).toHaveTextContent('1');
    });

    it('shows active goals preview when goals exist', async () => {
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);

      render(<CoachView />);

      await waitFor(() => {
        // Should see goal titles in the sidebar preview
        // Note: Learn Spanish may appear in multiple places (welcome message + sidebar)
        expect(screen.getAllByText('Learn Spanish').length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText('Run a marathon').length).toBeGreaterThan(0);
    });

    it('shows goal category and status in preview', async () => {
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText(/personal.*in progress/i)).toBeInTheDocument();
      });
    });

    it('shows disclaimer about AI limitations', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText(/not a substitute for professional therapy/)).toBeInTheDocument();
      });
    });
  });

  describe('Message Display', () => {
    it('displays message timestamps', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'AI Coach' })).toBeInTheDocument();
      });

      // Welcome message should have a timestamp displayed
      // Timestamps are shown in HH:MM format
      const timeRegex = /\d{1,2}:\d{2}/;
      const elements = document.querySelectorAll('.text-xs');
      const hasTimestamp = Array.from(elements).some(el => timeRegex.test(el.textContent || ''));
      expect(hasTimestamp).toBe(true);
    });

    it('shows different styling for user and assistant messages', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // User message has "You" label
      await waitFor(() => {
        expect(screen.getByText('You')).toBeInTheDocument();
      });

      // Multiple AI Coach labels (welcome + response)
      const coachLabels = screen.getAllByText('AI Coach');
      expect(coachLabels.length).toBeGreaterThanOrEqual(2);
    });

    it('renders markdown bold text correctly', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'AI Coach' })).toBeInTheDocument();
      });

      // Welcome message contains **bold** text which should render as <strong>
      const strongElements = document.querySelectorAll('strong');
      expect(strongElements.length).toBeGreaterThan(0);
    });
  });

  describe('Header and Layout', () => {
    it('displays AI Coach title', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'AI Coach' })).toBeInTheDocument();
      });
    });

    it('displays subtitle description', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText('Your personal guide for life planning and reflection')).toBeInTheDocument();
      });
    });

    it('shows help text about pressing Enter', async () => {
      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByText(/Press Enter to send/)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles goals without milestones in response', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const goalWithoutMilestones: Goal[] = [{
        ...mockGoals[0],
        milestones: [],
      }];
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(goalWithoutMilestones);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Tell me about my goals{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/breaking this down into smaller milestones/)).toBeInTheDocument();
      });
    });

    it('handles no active goals', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const completedGoals: Goal[] = [{
        ...mockGoals[0],
        status: 'completed',
      }];
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(completedGoals);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'What about my goal progress?{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/don't see any active goals/)).toBeInTheDocument();
      });
    });

    it('handles no timeline events for pattern query', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Show me my timeline patterns{enter}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/don't see any timeline events/)).toBeInTheDocument();
      });
    });

    it('limits suggested prompts to maximum of 3', async () => {
      const user = userEvent.setup();
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoals);
      (timelineEvents.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

      render(<CoachView />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      });

      // Enable all focus options
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[2]); // Mental Wellness
      await user.click(checkboxes[3]); // Career Guidance

      // Get only the suggested prompt buttons (btn-secondary class, not the send button)
      const promptButtons = screen.getAllByRole('button').filter(
        btn => btn.classList.contains('btn-secondary')
      );
      expect(promptButtons.length).toBeLessThanOrEqual(3);
    });

    it('only shows goals preview for active goals (not completed)', async () => {
      const mixedGoals: Goal[] = [
        { ...mockGoals[0], status: 'in_progress' },
        { ...mockGoals[1], status: 'completed', title: 'Completed Goal' },
      ];
      (goals.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mixedGoals);

      render(<CoachView />);

      await waitFor(() => {
        // Learn Spanish may appear in welcome message too
        expect(screen.getAllByText('Learn Spanish').length).toBeGreaterThan(0);
      });

      // Completed goal should not appear in the active goals preview
      expect(screen.queryByText('Completed Goal')).not.toBeInTheDocument();
    });
  });
});
