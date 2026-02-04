import { describe, it, expect } from 'vitest';
import {
  LAYER_KEYWORDS,
  detectLayer,
  detectLayerFromFields,
  matchesLayer,
  getAllMatchingLayers,
  detectPostLayer,
  detectCalendarEventLayer,
} from '@/lib/import/layerDetection';

describe('Layer Detection', () => {
  describe('LAYER_KEYWORDS', () => {
    it('has keywords for all layers', () => {
      expect(LAYER_KEYWORDS.travel.length).toBeGreaterThan(0);
      expect(LAYER_KEYWORDS.work.length).toBeGreaterThan(0);
      expect(LAYER_KEYWORDS.health.length).toBeGreaterThan(0);
      expect(LAYER_KEYWORDS.education.length).toBeGreaterThan(0);
      expect(LAYER_KEYWORDS.relationships.length).toBeGreaterThan(0);
      expect(LAYER_KEYWORDS.economics.length).toBeGreaterThan(0);
      expect(LAYER_KEYWORDS.media.length).toBeGreaterThan(0);
    });

    it('keywords are lowercase', () => {
      for (const keywords of Object.values(LAYER_KEYWORDS)) {
        for (const keyword of keywords) {
          expect(keyword).toBe(keyword.toLowerCase());
        }
      }
    });
  });

  describe('detectLayer', () => {
    it('returns default layer for empty input', () => {
      expect(detectLayer('').layer).toBe('media');
      expect(detectLayer('', { defaultLayer: 'work' }).layer).toBe('work');
    });

    it('detects travel layer', () => {
      expect(detectLayer('Booked a flight to Paris').layer).toBe('travel');
      expect(detectLayer('Staying at the hotel').layer).toBe('travel');
      expect(detectLayer('Vacation time!').layer).toBe('travel');
    });

    it('detects work layer', () => {
      expect(detectLayer('Team meeting at 10am').layer).toBe('work');
      expect(detectLayer('Interview with candidate').layer).toBe('work');
      expect(detectLayer('Presentation for client').layer).toBe('work');
    });

    it('detects health layer', () => {
      expect(detectLayer('Doctor appointment').layer).toBe('health');
      expect(detectLayer('Going to the gym').layer).toBe('health');
      expect(detectLayer('Dentist checkup').layer).toBe('health');
    });

    it('detects education layer', () => {
      expect(detectLayer('Math class at 2pm').layer).toBe('education');
      expect(detectLayer('Final exam tomorrow').layer).toBe('education');
      expect(detectLayer('University lecture').layer).toBe('education');
    });

    it('detects relationships layer', () => {
      expect(detectLayer('Birthday party for John').layer).toBe('relationships');
      expect(detectLayer('Wedding anniversary').layer).toBe('relationships');
      expect(detectLayer('Family reunion').layer).toBe('relationships');
    });

    it('detects economics layer', () => {
      expect(detectLayer('Tax filing deadline').layer).toBe('economics');
      expect(detectLayer('Investment meeting').layer).toBe('economics');
      expect(detectLayer('Mortgage payment due').layer).toBe('economics');
    });

    it('detects media layer', () => {
      expect(detectLayer('Posted new photos').layer).toBe('media');
      expect(detectLayer('Concert tonight!').layer).toBe('media');
    });

    it('is case insensitive', () => {
      expect(detectLayer('FLIGHT BOOKED').layer).toBe('travel');
      expect(detectLayer('Meeting').layer).toBe('work');
    });

    it('returns matched keywords', () => {
      const result = detectLayer('Flight to hotel for vacation');
      expect(result.matchedKeywords).toContain('flight');
      expect(result.matchedKeywords).toContain('hotel');
      expect(result.matchedKeywords).toContain('vacation');
    });

    it('returns score based on keyword count', () => {
      const singleMatch = detectLayer('Meeting');
      const multiMatch = detectLayer('Team meeting with client');
      expect(multiMatch.score).toBeGreaterThan(singleMatch.score);
    });

    it('respects minScore option', () => {
      const result = detectLayer('meeting', { minScore: 2 });
      expect(result.layer).toBe('media'); // Default because score < minScore
    });

    it('adds bonus for hasLocation', () => {
      const withoutLocation = detectLayer('Random event', { hasLocation: false });
      const withLocation = detectLayer('Random event', { hasLocation: true });
      expect(withLocation.layer).toBe('travel');
    });

    it('supports custom keywords', () => {
      const result = detectLayer('quarterly OKR review', {
        customKeywords: { work: ['okr'] },
      });
      expect(result.layer).toBe('work');
    });
  });

  describe('detectLayerFromFields', () => {
    it('combines multiple fields for detection', () => {
      const layer = detectLayerFromFields({
        title: 'Team sync',
        description: 'Monthly standup meeting',
      });
      expect(layer).toBe('work');
    });

    it('detects travel from location field', () => {
      const layer = detectLayerFromFields({
        title: 'Dinner',
        location: 'Paris, France',
      });
      expect(layer).toBe('travel');
    });

    it('handles empty fields', () => {
      const layer = detectLayerFromFields({
        title: '',
        description: undefined,
      });
      expect(layer).toBe('media'); // Default
    });

    it('prioritizes based on combined text', () => {
      const layer = detectLayerFromFields({
        title: 'Annual checkup',
        description: 'Visit to the doctor',
        location: 'Medical Center',
      });
      expect(layer).toBe('health');
    });
  });

  describe('matchesLayer', () => {
    it('returns true when text matches layer', () => {
      expect(matchesLayer('Flight booking', 'travel')).toBe(true);
      expect(matchesLayer('Team meeting', 'work')).toBe(true);
      expect(matchesLayer('Doctor visit', 'health')).toBe(true);
    });

    it('returns false when text does not match', () => {
      expect(matchesLayer('Random text', 'travel')).toBe(false);
      expect(matchesLayer('', 'work')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(matchesLayer('FLIGHT', 'travel')).toBe(true);
    });
  });

  describe('getAllMatchingLayers', () => {
    it('returns all matching layers', () => {
      const layers = getAllMatchingLayers('Flight to hotel for vacation');
      expect(layers).toContain('travel');
    });

    it('returns multiple layers for mixed content', () => {
      const layers = getAllMatchingLayers('Meeting about the flight schedule');
      expect(layers).toContain('travel');
      expect(layers).toContain('work');
    });

    it('returns empty array for no matches', () => {
      expect(getAllMatchingLayers('')).toEqual([]);
      expect(getAllMatchingLayers('xyz123')).toEqual([]);
    });
  });

  describe('detectPostLayer', () => {
    it('returns travel for posts with location', () => {
      expect(detectPostLayer('Great day!', true)).toBe('travel');
    });

    it('detects layer from post text', () => {
      expect(detectPostLayer('At the gym working out')).toBe('health');
      expect(detectPostLayer('Graduated today!')).toBe('education');
    });

    it('returns media as default', () => {
      expect(detectPostLayer('Just a random post')).toBe('media');
    });
  });

  describe('detectCalendarEventLayer', () => {
    it('detects layer from calendar fields', () => {
      expect(detectCalendarEventLayer('Team standup', 'Daily sync meeting')).toBe('work');
      expect(detectCalendarEventLayer('Flight to NYC')).toBe('travel');
      expect(detectCalendarEventLayer('Doctor appointment', undefined, 'Medical Center')).toBe('health');
    });

    it('returns default for generic events', () => {
      expect(detectCalendarEventLayer('Event')).toBe('media');
    });

    it('considers location for travel', () => {
      expect(detectCalendarEventLayer('Dinner', undefined, 'Paris')).toBe('travel');
    });
  });

  describe('edge cases', () => {
    it('handles very long text', () => {
      const longText = 'meeting '.repeat(1000);
      const result = detectLayer(longText);
      expect(result.layer).toBe('work');
    });

    it('handles special characters', () => {
      expect(detectLayer('Meeting! @office #work').layer).toBe('work');
      expect(detectLayer('Flïght tô Pärís').layer).toBe('travel');
    });

    it('handles multiple strong matches', () => {
      // When work has more matches (office, meeting, client, presentation) than travel (flight),
      // work wins based on higher score
      const result = detectLayer('Flight to office meeting with client presentation');
      expect(result.layer).toBe('work');

      // When scores are equal, the first matching layer in priority order wins
      // Since priority iterates from lowest to highest, earlier matches persist
      const tieResult = detectLayer('Flight meeting');
      // Both have score 1, work is encountered before travel in LAYER_PRIORITY
      expect(tieResult.layer).toBe('work');
    });

    it('handles null-like values', () => {
      expect(detectLayer(null as unknown as string).layer).toBe('media');
      expect(detectLayer(undefined as unknown as string).layer).toBe('media');
    });
  });
});
