/**
 * Shared layer detection for import sources
 * Categorizes events into timeline layers based on keywords and context
 */

import type { DataLayer } from '@/types';

/**
 * Keyword lists for layer detection
 * Each list contains lowercase keywords that indicate a particular layer
 */
export const LAYER_KEYWORDS: Record<DataLayer, string[]> = {
  travel: [
    'flight', 'airport', 'airline', 'airplane', 'plane',
    'hotel', 'hostel', 'airbnb', 'accommodation', 'resort',
    'travel', 'trip', 'vacation', 'holiday', 'journey',
    'passport', 'visa', 'customs', 'immigration',
    'tourist', 'sightseeing', 'destination',
    'road trip', 'cruise', 'tour',
    'departure', 'arrival', 'layover', 'transit',
  ],
  work: [
    'meeting', 'standup', 'stand-up', 'sync',
    'call', 'conference', 'presentation', 'demo',
    'interview', 'review', 'retrospective', 'retro',
    'work', 'office', 'workplace', 'coworking',
    'deadline', 'sprint', 'milestone', 'project',
    'client', 'customer', 'stakeholder',
    'onboarding', 'training', 'workshop',
    'promotion', 'salary', 'performance',
    'team', 'department', 'company',
    'linkedin', 'professional', 'networking',
    'contract', 'freelance', 'consulting',
  ],
  health: [
    'doctor', 'physician', 'specialist', 'nurse',
    'hospital', 'clinic', 'medical', 'healthcare',
    'dentist', 'dental', 'orthodontist',
    'therapist', 'therapy', 'counseling', 'counselor',
    'psychiatrist', 'psychologist', 'mental health',
    'gym', 'workout', 'exercise', 'fitness',
    'yoga', 'meditation', 'wellness',
    'physical therapy', 'physiotherapy', 'pt',
    'checkup', 'check-up', 'appointment', 'screening',
    'vaccine', 'vaccination', 'immunization',
    'prescription', 'medication', 'pharmacy',
    'surgery', 'procedure', 'treatment',
    'blood test', 'lab work', 'x-ray', 'mri', 'scan',
    'optometrist', 'eye exam', 'glasses', 'contacts',
    'dermatologist', 'chiropractor', 'nutritionist',
  ],
  education: [
    'class', 'lecture', 'seminar', 'tutorial',
    'course', 'coursework', 'curriculum',
    'exam', 'test', 'quiz', 'assessment',
    'study', 'studying', 'homework', 'assignment',
    'school', 'university', 'college', 'campus',
    'professor', 'teacher', 'instructor', 'tutor',
    'degree', 'diploma', 'certificate', 'certification',
    'graduation', 'graduated', 'commencement', 'convocation',
    'scholarship', 'fellowship', 'grant',
    'research', 'thesis', 'dissertation',
    'student', 'academic', 'educational',
    'library', 'lab', 'laboratory',
    'major', 'minor', 'gpa', 'credits',
    'enrollment', 'registration', 'semester', 'quarter',
  ],
  relationships: [
    'wedding', 'marriage', 'engagement', 'proposal',
    'anniversary', 'birthday', 'celebration',
    'family', 'parent', 'sibling', 'relative',
    'friend', 'friendship', 'bestie',
    'dating', 'date', 'relationship',
    'baby shower', 'birth', 'newborn',
    'reunion', 'gathering', 'party',
    'funeral', 'memorial', 'passing',
    'divorce', 'separation', 'breakup',
    'adoption', 'custody',
    'godparent', 'baptism', 'christening',
    'bar mitzvah', 'bat mitzvah', 'confirmation',
    'connected with', 'met', 'introduced',
  ],
  economics: [
    'salary', 'wage', 'income', 'earnings',
    'tax', 'taxes', 'irs', 'filing',
    'investment', 'investing', 'portfolio',
    'stock', 'stocks', 'bond', 'mutual fund',
    'retirement', '401k', 'ira', 'pension',
    'mortgage', 'loan', 'debt', 'credit',
    'bank', 'banking', 'account',
    'budget', 'budgeting', 'financial',
    'insurance', 'policy', 'premium',
    'purchase', 'bought', 'sale', 'sold',
    'property', 'real estate', 'house', 'apartment',
    'car', 'vehicle', 'lease',
    'business', 'startup', 'entrepreneur',
    'invoice', 'payment', 'bill',
  ],
  media: [
    'photo', 'picture', 'image', 'selfie',
    'video', 'movie', 'film', 'recording',
    'post', 'status', 'update', 'shared',
    'instagram', 'facebook', 'twitter', 'tiktok',
    'youtube', 'spotify', 'netflix',
    'concert', 'show', 'performance', 'event',
    'album', 'playlist', 'song', 'music',
    'book', 'reading', 'podcast', 'article',
    'game', 'gaming', 'stream', 'twitch',
    'upload', 'download', 'content',
  ],
};

/**
 * Layer priority for conflicts (higher index = higher priority)
 */
const LAYER_PRIORITY: DataLayer[] = [
  'media',        // Default/lowest priority
  'economics',
  'education',
  'relationships',
  'health',
  'work',
  'travel',       // Highest priority (specific intent)
];

/**
 * Options for layer detection
 */
export interface LayerDetectionOptions {
  /** Default layer if no keywords match */
  defaultLayer?: DataLayer;
  /** Minimum keyword match score to override default */
  minScore?: number;
  /** Whether to check for location (indicates travel) */
  hasLocation?: boolean;
  /** Additional custom keywords by layer */
  customKeywords?: Partial<Record<DataLayer, string[]>>;
}

/**
 * Result of layer detection
 */
export interface LayerDetectionResult {
  layer: DataLayer;
  score: number;
  matchedKeywords: string[];
}

/**
 * Normalize text for matching by removing diacritics and special characters
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase();
}

/**
 * Detect the most appropriate layer for an event based on text content
 */
export function detectLayer(
  text: string,
  options: LayerDetectionOptions = {}
): LayerDetectionResult {
  const {
    defaultLayer = 'media',
    minScore = 1,
    hasLocation = false,
    customKeywords = {},
  } = options;

  if (!text || typeof text !== 'string') {
    return { layer: defaultLayer, score: 0, matchedKeywords: [] };
  }

  const lowerText = normalizeText(text);
  const scores: Map<DataLayer, { score: number; keywords: string[] }> = new Map();

  // Initialize scores
  for (const layer of Object.keys(LAYER_KEYWORDS) as DataLayer[]) {
    scores.set(layer, { score: 0, keywords: [] });
  }

  // Check each layer's keywords using word boundary matching
  for (const [layer, keywords] of Object.entries(LAYER_KEYWORDS) as [DataLayer, string[]][]) {
    const allKeywords = [...keywords, ...(customKeywords[layer] || [])];
    const layerScore = scores.get(layer)!;

    for (const keyword of allKeywords) {
      // Use word boundary regex to avoid substring matches (e.g., 'book' in 'booked')
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText)) {
        layerScore.score += 1;
        layerScore.keywords.push(keyword);
      }
    }
  }

  // Bonus for having location (strongly suggests travel)
  if (hasLocation) {
    const travelScore = scores.get('travel')!;
    travelScore.score += 2; // Strong bonus to override single keyword matches
  }

  // Find the layer with highest score
  // For ties, the first layer found (lower priority) wins - this is intentional
  // because specific keywords should determine the layer, not arbitrary priority
  let bestLayer = defaultLayer;
  let bestScore = 0;
  let bestKeywords: string[] = [];

  for (const layer of LAYER_PRIORITY) {
    const layerScore = scores.get(layer)!;
    if (layerScore.score > bestScore) {
      bestLayer = layer;
      bestScore = layerScore.score;
      bestKeywords = layerScore.keywords;
    }
  }

  // Only return detected layer if score meets minimum
  if (bestScore < minScore) {
    return { layer: defaultLayer, score: 0, matchedKeywords: [] };
  }

  return {
    layer: bestLayer,
    score: bestScore,
    matchedKeywords: bestKeywords,
  };
}

/**
 * Detect layer from multiple text fields (title, description, location, etc.)
 */
export function detectLayerFromFields(
  fields: {
    title?: string;
    description?: string;
    location?: string;
    [key: string]: string | undefined;
  },
  options: LayerDetectionOptions = {}
): DataLayer {
  // Combine all text fields
  const combinedText = Object.values(fields)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ');

  // Check if location is present
  const hasLocation = !!(fields.location && fields.location.trim().length > 0);

  const result = detectLayer(combinedText, { ...options, hasLocation });
  return result.layer;
}

/**
 * Check if text matches a specific layer
 */
export function matchesLayer(text: string, layer: DataLayer): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  const keywords = LAYER_KEYWORDS[layer] || [];

  return keywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Get all matching layers for a piece of text
 */
export function getAllMatchingLayers(text: string): DataLayer[] {
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const matchingLayers: DataLayer[] = [];

  for (const [layer, keywords] of Object.entries(LAYER_KEYWORDS) as [DataLayer, string[]][]) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      matchingLayers.push(layer);
    }
  }

  return matchingLayers;
}

/**
 * Common layer detection for social media posts
 * Uses simpler logic suited for posts/updates
 */
export function detectPostLayer(
  postText: string,
  hasLocation?: boolean,
  hasMedia?: boolean
): DataLayer {
  if (hasLocation) {
    return 'travel';
  }

  const result = detectLayer(postText, {
    defaultLayer: hasMedia ? 'media' : 'media',
    minScore: 1,
  });

  return result.layer;
}

/**
 * Determine layer for calendar events
 * Uses keyword detection with calendar-specific defaults
 */
export function detectCalendarEventLayer(
  summary: string,
  description?: string,
  location?: string
): DataLayer {
  return detectLayerFromFields(
    { title: summary, description, location },
    { defaultLayer: 'media' }
  );
}
