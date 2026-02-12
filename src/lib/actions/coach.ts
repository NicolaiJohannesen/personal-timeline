'use server';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { buildSystemPrompt, type ContextSummary } from '@/lib/coach/contextBuilder';

// Schema for the coach request
const CoachRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  apiKey: z.string().min(1),
  model: z.string().default('claude-sonnet-4-20250514'),
  context: z.object({
    profileName: z.string().optional(),
    eventsCount: z.number(),
    eventsByLayer: z.record(z.string(), z.number()),
    recentEvents: z
      .array(
        z.object({
          title: z.string(),
          layer: z.string(),
          date: z.string(),
        })
      )
      .max(20),
    activeGoals: z.array(
      z.object({
        title: z.string(),
        category: z.string(),
        status: z.string(),
        milestoneProgress: z.string(),
      })
    ),
    assessmentSummary: z.record(z.string(), z.unknown()).optional(),
    coachingFocus: z.object({
      goalProgress: z.boolean(),
      lifePatterns: z.boolean(),
      mentalWellness: z.boolean(),
      careerGuidance: z.boolean(),
    }),
  }),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20),
});

export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export interface CoachResponse {
  success: boolean;
  response?: string;
  error?: string;
}

/**
 * Generate a coaching response using the Anthropic Claude API
 */
export async function generateCoachResponse(request: CoachRequest): Promise<CoachResponse> {
  // Validate the request
  const parseResult = CoachRequestSchema.safeParse(request);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Invalid request: ' + parseResult.error.message,
    };
  }

  const { message, apiKey, model, context, conversationHistory } = parseResult.data;

  try {
    // Initialize Anthropic client with the provided API key
    const client = new Anthropic({
      apiKey,
    });

    // Build the system prompt with context
    const systemPrompt = buildSystemPrompt(context as ContextSummary);

    // Build messages array
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // Call the Anthropic API
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Extract the text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        success: false,
        error: 'No text response received from AI',
      };
    }

    return {
      success: true,
      response: textContent.text,
    };
  } catch (error) {
    // Handle specific Anthropic errors using duck typing for better testability
    const apiError = error as { status?: number; message?: string };
    if (typeof apiError.status === 'number') {
      if (apiError.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your API key in Settings.',
        };
      }
      if (apiError.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait a moment and try again.',
        };
      }
      if (apiError.status === 500 || apiError.status === 503) {
        return {
          success: false,
          error: 'AI service is temporarily unavailable. Please try again later.',
        };
      }
      return {
        success: false,
        error: `API error: ${apiError.message || 'Unknown error'}`,
      };
    }

    // Generic error handling
    console.error('Coach API error:', error);
    return {
      success: false,
      error: 'Failed to generate response. Please try again.',
    };
  }
}
