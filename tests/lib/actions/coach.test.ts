import { describe, it, expect } from 'vitest';
import type { CoachRequest } from '@/lib/actions/coach';

/**
 * Tests for the coach Server Action.
 *
 * Note: The Anthropic SDK is difficult to mock properly in vitest due to
 * module hoisting behavior. These tests focus on validation logic.
 * Integration testing with the real API should be done manually.
 */

describe('generateCoachResponse - validation', () => {
  // We import dynamically to avoid the Anthropic client initialization issues
  const getGenerateCoachResponse = async () => {
    const { generateCoachResponse } = await import('@/lib/actions/coach');
    return generateCoachResponse;
  };

  const validContext = {
    profileName: 'Test User',
    eventsCount: 10,
    eventsByLayer: { work: 5, travel: 3, health: 2 },
    recentEvents: [
      { title: 'Started job', layer: 'work', date: '2024-01-01' },
    ],
    activeGoals: [
      {
        title: 'Learn Spanish',
        category: 'education',
        status: 'in progress',
        milestoneProgress: '1/3 milestones',
      },
    ],
    coachingFocus: {
      goalProgress: true,
      lifePatterns: true,
      mentalWellness: false,
      careerGuidance: false,
    },
  };

  it('should reject empty message', async () => {
    const generateCoachResponse = await getGenerateCoachResponse();
    const invalidRequest: CoachRequest = {
      message: '',
      apiKey: 'sk-test-key',
      model: 'claude-sonnet-4-20250514',
      context: validContext,
      conversationHistory: [],
    };

    const result = await generateCoachResponse(invalidRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('should reject empty API key', async () => {
    const generateCoachResponse = await getGenerateCoachResponse();
    const invalidRequest: CoachRequest = {
      message: 'Hello',
      apiKey: '',
      model: 'claude-sonnet-4-20250514',
      context: validContext,
      conversationHistory: [],
    };

    const result = await generateCoachResponse(invalidRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('should reject message that exceeds max length', async () => {
    const generateCoachResponse = await getGenerateCoachResponse();
    const longMessage = 'a'.repeat(10001);
    const invalidRequest: CoachRequest = {
      message: longMessage,
      apiKey: 'sk-test-key',
      model: 'claude-sonnet-4-20250514',
      context: validContext,
      conversationHistory: [],
    };

    const result = await generateCoachResponse(invalidRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('should reject conversation history that exceeds max length', async () => {
    const generateCoachResponse = await getGenerateCoachResponse();
    const tooManyMessages = Array.from({ length: 21 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
    }));

    const invalidRequest: CoachRequest = {
      message: 'Hello',
      apiKey: 'sk-test-key',
      model: 'claude-sonnet-4-20250514',
      context: validContext,
      conversationHistory: tooManyMessages,
    };

    const result = await generateCoachResponse(invalidRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('should reject invalid context structure', async () => {
    const generateCoachResponse = await getGenerateCoachResponse();
    const invalidRequest = {
      message: 'Hello',
      apiKey: 'sk-test-key',
      model: 'claude-sonnet-4-20250514',
      context: {
        // Missing required fields
        eventsCount: 'not a number', // wrong type
      },
      conversationHistory: [],
    };

    const result = await generateCoachResponse(invalidRequest as CoachRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('should reject invalid conversation history role', async () => {
    const generateCoachResponse = await getGenerateCoachResponse();
    const invalidRequest = {
      message: 'Hello',
      apiKey: 'sk-test-key',
      model: 'claude-sonnet-4-20250514',
      context: validContext,
      conversationHistory: [
        { role: 'system', content: 'This should not be allowed' },
      ],
    };

    const result = await generateCoachResponse(invalidRequest as CoachRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('should accept valid request structure', async () => {
    // This test will fail because the API key is not valid,
    // but it should pass validation
    const generateCoachResponse = await getGenerateCoachResponse();
    const validRequest: CoachRequest = {
      message: 'How can I improve my goals?',
      apiKey: 'sk-test-key-that-will-fail',
      model: 'claude-sonnet-4-20250514',
      context: validContext,
      conversationHistory: [],
    };

    const result = await generateCoachResponse(validRequest);

    // If validation passed, we should get an API error, not a validation error
    // The request will fail but not due to validation
    expect(result.success).toBe(false);
    // Should NOT contain "Invalid request" - should be an API-related error
    expect(result.error).not.toContain('Invalid request');
  });
});
