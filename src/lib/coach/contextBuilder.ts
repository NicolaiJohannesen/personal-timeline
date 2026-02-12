import type { TimelineEvent, Goal, UserProfile, AssessmentResult, DataLayer } from '@/types';

export interface CoachingFocus {
  goalProgress: boolean;
  lifePatterns: boolean;
  mentalWellness: boolean;
  careerGuidance: boolean;
}

export interface CoachingContext {
  events: TimelineEvent[];
  goals: Goal[];
  profile: UserProfile | null;
  assessments: AssessmentResult[];
}

export interface ContextSummary {
  profileName?: string;
  eventsCount: number;
  eventsByLayer: Record<string, number>;
  recentEvents: Array<{
    title: string;
    layer: string;
    date: string;
  }>;
  activeGoals: Array<{
    title: string;
    category: string;
    status: string;
    milestoneProgress: string;
  }>;
  assessmentSummary?: Record<string, unknown>;
  coachingFocus: CoachingFocus;
}

/**
 * Build a summary of the user's context for the LLM
 */
export function buildContextSummary(
  context: CoachingContext,
  coachingFocus: CoachingFocus
): ContextSummary {
  // Count events by layer
  const eventsByLayer: Record<string, number> = {};
  context.events.forEach((event) => {
    eventsByLayer[event.layer] = (eventsByLayer[event.layer] || 0) + 1;
  });

  // Get recent events (last 20, sorted by date)
  const sortedEvents = [...context.events]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 20);

  const recentEvents = sortedEvents.map((event) => ({
    title: event.title,
    layer: event.layer,
    date: new Date(event.startDate).toISOString().split('T')[0],
  }));

  // Get active goals with progress
  const activeGoals = context.goals
    .filter((g) => g.status === 'in_progress' || g.status === 'not_started')
    .map((goal) => {
      const completed = goal.milestones.filter((m) => m.completed).length;
      const total = goal.milestones.length;
      const progress = total > 0 ? `${completed}/${total} milestones` : 'No milestones set';

      return {
        title: goal.title,
        category: goal.category,
        status: goal.status.replace('_', ' '),
        milestoneProgress: progress,
      };
    });

  // Summarize assessments
  let assessmentSummary: Record<string, unknown> | undefined;
  if (context.assessments.length > 0) {
    assessmentSummary = {};
    context.assessments.forEach((assessment) => {
      assessmentSummary![assessment.assessmentType] = {
        completedAt: new Date(assessment.completedAt).toISOString().split('T')[0],
        scores: assessment.scores,
      };
    });
  }

  return {
    profileName: context.profile?.name,
    eventsCount: context.events.length,
    eventsByLayer,
    recentEvents,
    activeGoals,
    assessmentSummary,
    coachingFocus,
  };
}

/**
 * Build the system prompt for the AI Coach
 */
export function buildSystemPrompt(contextSummary: ContextSummary): string {
  const focusAreas: string[] = [];
  if (contextSummary.coachingFocus.goalProgress) focusAreas.push('goal progress and achievement');
  if (contextSummary.coachingFocus.lifePatterns) focusAreas.push('life patterns and trends');
  if (contextSummary.coachingFocus.mentalWellness) focusAreas.push('mental wellness and emotional support');
  if (contextSummary.coachingFocus.careerGuidance) focusAreas.push('career guidance and professional development');

  let prompt = `You are an AI Life Coach helping a user reflect on their life journey and plan for the future. You have access to their personal timeline data and goals.

## Your Role
- Provide thoughtful, personalized guidance based on the user's data
- Ask reflective questions to help them gain insights
- Be supportive and encouraging while also being honest
- Help connect patterns in their life to their goals and aspirations
- Keep responses concise but meaningful (2-4 paragraphs typically)

## Coaching Focus Areas
The user has selected these areas for coaching: ${focusAreas.join(', ') || 'general life guidance'}.

## User Context
`;

  if (contextSummary.profileName) {
    prompt += `- Name: ${contextSummary.profileName}\n`;
  }

  prompt += `- Total Timeline Events: ${contextSummary.eventsCount}\n`;

  if (Object.keys(contextSummary.eventsByLayer).length > 0) {
    prompt += `- Events by Category:\n`;
    Object.entries(contextSummary.eventsByLayer)
      .sort((a, b) => b[1] - a[1])
      .forEach(([layer, count]) => {
        prompt += `  - ${layer}: ${count} events\n`;
      });
  }

  if (contextSummary.activeGoals.length > 0) {
    prompt += `\n## Active Goals\n`;
    contextSummary.activeGoals.forEach((goal) => {
      prompt += `- "${goal.title}" (${goal.category}, ${goal.status}) - ${goal.milestoneProgress}\n`;
    });
  }

  if (contextSummary.recentEvents.length > 0) {
    prompt += `\n## Recent Events (last ${contextSummary.recentEvents.length})\n`;
    contextSummary.recentEvents.slice(0, 10).forEach((event) => {
      prompt += `- ${event.date}: ${event.title} [${event.layer}]\n`;
    });
  }

  if (contextSummary.assessmentSummary) {
    prompt += `\n## Completed Assessments\n`;
    Object.entries(contextSummary.assessmentSummary).forEach(([type, data]) => {
      const info = data as { completedAt: string; scores: Record<string, unknown> };
      prompt += `- ${type.replace('_', ' ')}: completed ${info.completedAt}\n`;
    });
  }

  prompt += `
## Guidelines
- Use the context above to personalize your responses
- Reference specific goals or events when relevant
- Don't repeat the context back verbatim; use it naturally
- If asked about something not in the context, acknowledge the limitation
- Always maintain a supportive, professional coaching tone
- Encourage action and reflection, not just passive listening`;

  return prompt;
}

/**
 * Format conversation history for the API
 */
export function formatConversationHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Limit to last 10 messages to stay within token limits
  return messages.slice(-10).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
