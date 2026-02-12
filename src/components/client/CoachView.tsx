'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { timelineEvents, userProfile, goals, assessments } from '@/lib/db';
import type { TimelineEvent, Goal, UserProfile, AssessmentResult, AISettings } from '@/types';
import { createAbortController } from '@/lib/utils/asyncCleanup';
import { buildContextSummary, type CoachingFocus } from '@/lib/coach/contextBuilder';
import { generateCoachResponse } from '@/lib/actions/coach';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CoachingContext {
  events: TimelineEvent[];
  goals: Goal[];
  profile: UserProfile | null;
  assessments: AssessmentResult[];
}

// Pre-defined coaching prompts based on context
const COACHING_PROMPTS = {
  goalProgress: [
    "How can I help you make progress on your goals today?",
    "I noticed you have some goals in progress. Would you like to discuss strategies for achieving them?",
    "Let's review your goal milestones and celebrate your progress!",
  ],
  lifePatterns: [
    "Looking at your timeline, I see some interesting patterns. Would you like to explore them?",
    "Your life events tell a story. Let's reflect on what they reveal about your journey.",
    "I can help you identify trends in your career, relationships, or personal growth.",
  ],
  mentalWellness: [
    "How are you feeling today? I'm here to listen and support you.",
    "Would you like to do a quick mood check-in?",
    "Remember, self-reflection is a powerful tool for mental wellness.",
  ],
  careerGuidance: [
    "Your career path shows growth. Let's discuss your next steps.",
    "Would you like help planning your career trajectory?",
    "I can help you articulate your professional narrative based on your experiences.",
  ],
};

// Mock AI responses based on user input patterns
function generateMockResponse(input: string, context: CoachingContext): string {
  const lowerInput = input.toLowerCase();

  // Goal-related queries
  if (lowerInput.includes('goal') || lowerInput.includes('progress') || lowerInput.includes('milestone')) {
    const activeGoals = context.goals.filter(g => g.status === 'in_progress' || g.status === 'not_started');
    if (activeGoals.length > 0) {
      const goal = activeGoals[0];
      const completedMilestones = goal.milestones.filter(m => m.completed).length;
      const totalMilestones = goal.milestones.length;
      return `I see you're working on "${goal.title}". ${totalMilestones > 0
        ? `You've completed ${completedMilestones} of ${totalMilestones} milestones - that's great progress!`
        : `Consider breaking this down into smaller milestones to track your progress.`} What's your next step toward this goal?`;
    }
    return "I don't see any active goals yet. Would you like to create one? Setting clear goals is the first step toward achieving them.";
  }

  // Timeline/pattern queries
  if (lowerInput.includes('timeline') || lowerInput.includes('pattern') || lowerInput.includes('event')) {
    if (context.events.length > 0) {
      const layerCounts: Record<string, number> = {};
      context.events.forEach(e => {
        layerCounts[e.layer] = (layerCounts[e.layer] || 0) + 1;
      });
      const topLayer = Object.entries(layerCounts).sort((a, b) => b[1] - a[1])[0];
      return `Looking at your ${context.events.length} timeline events, I notice most activity in your ${topLayer[0]} layer (${topLayer[1]} events). This suggests it's been a significant focus in your life. Would you like to explore what patterns emerge from this data?`;
    }
    return "I don't see any timeline events yet. Import some data to help me understand your life journey better.";
  }

  // Mood/wellness queries
  if (lowerInput.includes('mood') || lowerInput.includes('feel') || lowerInput.includes('wellness') || lowerInput.includes('stress')) {
    return "I appreciate you sharing how you're feeling. Remember that emotions are data about our needs. What do you think might be contributing to how you feel right now? And what's one small thing you could do today to support your wellbeing?";
  }

  // Career queries
  if (lowerInput.includes('career') || lowerInput.includes('job') || lowerInput.includes('work') || lowerInput.includes('professional')) {
    const workEvents = context.events.filter(e => e.layer === 'work');
    if (workEvents.length > 0) {
      return `I can see ${workEvents.length} work-related events in your timeline. Your career journey shows important milestones. What aspect of your professional development would you like to focus on?`;
    }
    return "Tell me more about your career aspirations. What kind of professional growth are you hoping to achieve?";
  }

  // Assessment queries
  if (lowerInput.includes('assessment') || lowerInput.includes('personality') || lowerInput.includes('test')) {
    if (context.assessments.length > 0) {
      return `You've completed ${context.assessments.length} assessment(s). These insights can help guide your personal development. Would you like to discuss what your results mean for your goals?`;
    }
    return "I recommend taking some of our assessments to gain deeper insights into your personality, values, and risk tolerance. They can help inform your goal-setting and life planning.";
  }

  // Help/greeting
  if (lowerInput.includes('help') || lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
    return `Hello! I'm your AI Coach, here to help you reflect on your life journey and plan for the future. I can help you with:

• **Goal Progress**: Review and strategize on your dreamboard goals
• **Life Patterns**: Analyze trends in your timeline events
• **Mental Wellness**: Support your emotional wellbeing
• **Career Guidance**: Navigate professional decisions

What would you like to explore today?`;
  }

  // Default contextual response
  if (context.profile?.name) {
    return `That's a thoughtful question, ${context.profile.name}. Based on what I know about your journey, I'd suggest reflecting on how this connects to your bigger picture goals. What feels most important to you about this?`;
  }

  return "That's an interesting thought. Can you tell me more about what's on your mind? I'm here to help you reflect and plan.";
}

export function CoachView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState<CoachingContext>({
    events: [],
    goals: [],
    profile: null,
    assessments: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [aiSettings, setAISettings] = useState<AISettings | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [coachingFocus, setCoachingFocus] = useState<CoachingFocus>({
    goalProgress: true,
    lifePatterns: true,
    mentalWellness: false,
    careerGuidance: false,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load context data
  useEffect(() => {
    const { isAborted, cleanup } = createAbortController();

    const loadContext = async () => {
      try {
        const [eventsData, profileData, goalsData, assessmentsData] = await Promise.all([
          timelineEvents.getAll(),
          userProfile.get(),
          goals.getAll(),
          assessments.getAll(),
        ]);

        if (isAborted()) return;

        setContext({
          events: eventsData,
          goals: goalsData,
          profile: profileData ?? null,
          assessments: assessmentsData,
        });

        // Load AI settings from profile
        if (profileData?.settings?.ai) {
          setAISettings(profileData.settings.ai);
        }

        // Add welcome message based on context
        const welcomeMessage = generateWelcomeMessage(
          profileData ?? null,
          goalsData,
          eventsData.length
        );

        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date(),
        }]);
      } catch (error) {
        if (isAborted()) return;
        console.error('Failed to load coach context:', error);
      } finally {
        if (!isAborted()) {
          setIsLoading(false);
        }
      }
    };

    loadContext();
    return cleanup;
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setError(null);

    let responseContent: string;

    // Check if we have an API key configured
    if (aiSettings?.apiKey && aiSettings.provider === 'anthropic') {
      try {
        // Build context summary for the LLM
        const contextSummary = buildContextSummary(
          {
            events: context.events,
            goals: context.goals,
            profile: context.profile,
            assessments: context.assessments,
          },
          coachingFocus
        );

        // Get conversation history (excluding welcome message)
        const conversationHistory = messages
          .filter(m => m.id !== 'welcome')
          .slice(-10)
          .map(m => ({
            role: m.role,
            content: m.content,
          }));

        // Call the Server Action
        const result = await generateCoachResponse({
          message: input.trim(),
          apiKey: aiSettings.apiKey,
          model: aiSettings.model || 'claude-sonnet-4-20250514',
          context: contextSummary,
          conversationHistory,
        });

        if (result.success && result.response) {
          responseContent = result.response;
        } else {
          // API call failed, show error and fallback to mock
          setError(result.error || 'Failed to get response from AI');
          responseContent = generateMockResponse(input, context);
        }
      } catch (err) {
        // Unexpected error, fallback to mock
        console.error('Error calling coach API:', err);
        setError('An unexpected error occurred. Using offline mode.');
        responseContent = generateMockResponse(input, context);
      }
    } else {
      // No API key configured, use mock responses
      // Add small delay to simulate thinking
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      responseContent = generateMockResponse(input, context);
    }

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const getSuggestedPrompts = () => {
    const prompts: string[] = [];

    if (coachingFocus.goalProgress && context.goals.length > 0) {
      const activeGoal = context.goals.find(g => g.status === 'in_progress');
      if (activeGoal) {
        prompts.push(`How am I doing on my "${activeGoal.title}" goal?`);
      } else {
        prompts.push("Help me review my goals");
      }
    }

    if (coachingFocus.lifePatterns && context.events.length > 0) {
      prompts.push("What patterns do you see in my timeline?");
    }

    if (coachingFocus.mentalWellness) {
      prompts.push("I'd like to do a mood check-in");
    }

    if (coachingFocus.careerGuidance) {
      prompts.push("Help me plan my career next steps");
    }

    if (prompts.length === 0) {
      prompts.push("What can you help me with?");
    }

    return prompts.slice(0, 3);
  };

  if (isLoading) {
    return (
      <div className="fade-in h-[calc(100vh-3rem)] flex flex-col">
        <div className="mb-6">
          <div className="h-9 w-32 bg-[var(--color-bg-secondary)] rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-[var(--color-bg-secondary)] rounded animate-pulse" />
        </div>
        <div className="flex-1 card-elevated animate-pulse" />
      </div>
    );
  }

  return (
    <div className="fade-in h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Coach</h1>
        <p className="text-[var(--color-text-secondary)]">
          Your personal guide for life planning and reflection
        </p>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col card-elevated">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'assistant'
                      ? 'bg-[var(--color-accent-primary)]'
                      : 'bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <svg className="w-5 h-5 text-[var(--color-bg-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium mb-1 ${
                    message.role === 'assistant'
                      ? 'text-[var(--color-accent-primary)]'
                      : 'text-[var(--color-text-secondary)]'
                  }`}>
                    {message.role === 'assistant' ? 'AI Coach' : 'You'}
                  </div>
                  <div className={`rounded-lg p-4 ${
                    message.role === 'assistant'
                      ? 'bg-[var(--color-bg-secondary)]'
                      : 'bg-[var(--color-accent-primary)]/10'
                  }`}>
                    <div className="text-[var(--color-text-primary)] whitespace-pre-wrap">
                      {message.content.split('\n').map((line, i) => {
                        // Handle bold text with **
                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                        return (
                          <p key={i} className={i > 0 ? 'mt-2' : ''}>
                            {parts.map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j}>{part.slice(2, -2)}</strong>;
                              }
                              // Handle bullet points
                              if (part.startsWith('• ')) {
                                return <span key={j} className="block ml-2">{part}</span>;
                              }
                              return part;
                            })}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--color-bg-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-accent-primary)] mb-1">
                    AI Coach
                  </div>
                  <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 inline-block">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts */}
          {messages.length <= 2 && (
            <div className="px-6 pb-4 flex gap-2 flex-wrap">
              {getSuggestedPrompts().map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="btn btn-secondary text-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-[var(--color-border-subtle)] p-4">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="input flex-1"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isTyping}
                className="btn btn-primary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Press Enter to send. {aiSettings?.apiKey ? 'Using Claude AI.' : 'Configure API key in Settings for AI-powered responses.'}
            </p>
          </div>
        </div>

        {/* Sidebar with Context */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Your Context
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Timeline Events</span>
                <span className="font-medium">{context.events.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Active Goals</span>
                <span className="font-medium">
                  {context.goals.filter(g => g.status === 'in_progress' || g.status === 'not_started').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Assessments</span>
                <span className="font-medium">{context.assessments.length}</span>
              </div>
            </div>
          </div>

          {/* Coaching Focus */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Coaching Focus
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coachingFocus.goalProgress}
                  onChange={(e) => setCoachingFocus(prev => ({ ...prev, goalProgress: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                />
                <span className="text-sm">Goal Progress</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coachingFocus.lifePatterns}
                  onChange={(e) => setCoachingFocus(prev => ({ ...prev, lifePatterns: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                />
                <span className="text-sm">Life Patterns</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coachingFocus.mentalWellness}
                  onChange={(e) => setCoachingFocus(prev => ({ ...prev, mentalWellness: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                />
                <span className="text-sm">Mental Wellness</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coachingFocus.careerGuidance}
                  onChange={(e) => setCoachingFocus(prev => ({ ...prev, careerGuidance: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                />
                <span className="text-sm">Career Guidance</span>
              </label>
            </div>
          </div>

          {/* Recent Goals Preview */}
          {context.goals.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Active Goals
              </h3>
              <div className="space-y-2">
                {context.goals
                  .filter(g => g.status === 'in_progress' || g.status === 'not_started')
                  .slice(0, 3)
                  .map(goal => (
                    <div key={goal.id} className="text-sm p-2 bg-[var(--color-bg-secondary)] rounded">
                      <div className="font-medium truncate">{goal.title}</div>
                      <div className="text-xs text-[var(--color-text-muted)] capitalize">
                        {goal.category} • {goal.status.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* AI Status */}
          <div className={`text-xs p-3 rounded-lg flex items-center gap-2 ${
            aiSettings?.apiKey
              ? 'bg-green-500/10 text-green-400'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              aiSettings?.apiKey ? 'bg-green-400' : 'bg-[var(--color-text-muted)]'
            }`} />
            <span>
              {aiSettings?.apiKey
                ? `Claude AI Connected (${aiSettings.model || 'claude-sonnet-4-20250514'})`
                : 'Offline Mode - Configure API key in Settings'}
            </span>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-[var(--color-text-muted)] p-3 bg-[var(--color-bg-secondary)] rounded-lg">
            <strong>Note:</strong> AI Coach provides guidance and support but is not a substitute for professional therapy or medical advice.
          </div>
        </div>
      </div>
    </div>
  );
}

function generateWelcomeMessage(
  profile: UserProfile | null,
  goals: Goal[],
  eventCount: number
): string {
  const name = profile?.name ? `, ${profile.name}` : '';
  const activeGoals = goals.filter(g => g.status === 'in_progress' || g.status === 'not_started');

  let contextInfo = '';

  if (eventCount > 0 || activeGoals.length > 0) {
    contextInfo = `\n\nI can see you have`;
    const parts = [];
    if (eventCount > 0) parts.push(`${eventCount} timeline event${eventCount !== 1 ? 's' : ''}`);
    if (activeGoals.length > 0) parts.push(`${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''}`);
    contextInfo += ` ${parts.join(' and ')}. I'll use this context to provide personalized guidance.`;
  }

  return `Welcome${name}! I'm your AI Coach, here to help you reflect on your journey and plan for the future.${contextInfo}

Here's what I can help you with:

• **Goal Progress**: Review and strategize on your dreamboard goals
• **Life Patterns**: Analyze trends and insights from your timeline
• **Mental Wellness**: Support your emotional wellbeing
• **Career Guidance**: Navigate professional decisions

What would you like to explore today?`;
}

export default CoachView;
