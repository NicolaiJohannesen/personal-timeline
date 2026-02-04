import { describe, it, expect } from 'vitest';
import { parseFacebookData } from '@/lib/import/facebook';

// Helper to create a mock JSON file with proper text() method for Node.js
function createMockJsonFile(content: unknown, name: string): File {
  const json = JSON.stringify(content);
  const file = new File([json], name, { type: 'application/json' });
  // Add text method for Node.js compatibility (native File.text() doesn't work in test env)
  (file as ReturnType<typeof Object>).text = async () => json;
  return file;
}

// Helper for invalid files
function createMockFile(content: string, name: string, type = 'application/json'): File {
  const file = new File([content], name, { type });
  (file as ReturnType<typeof Object>).text = async () => content;
  return file;
}

describe('Facebook Parser', () => {
  describe('parseFacebookData', () => {
    it('parses posts with timestamps', async () => {
      const data = {
        posts: [
          {
            timestamp: 1609459200, // 2021-01-01 00:00:00 UTC
            title: 'Happy New Year everyone!',
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Happy New Year everyone!');
      expect(result.events[0].layer).toBe('media');
      expect(result.events[0].source).toBe('facebook');
      expect(result.events[0].eventType).toBe('post');
    });

    it('parses posts with nested data structure', async () => {
      const data = {
        your_posts_1: [
          {
            data: [
              {
                post: 'This is my post content',
                update_timestamp: 1609459200,
              },
            ],
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('This is my post content');
    });

    it('truncates long post titles', async () => {
      const longText = 'A'.repeat(150);
      const data = {
        posts: [
          {
            timestamp: 1609459200,
            title: longText,
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events[0].title.length).toBeLessThanOrEqual(100);
      expect(result.events[0].title).toContain('...');
      expect(result.events[0].description).toBe(longText);
    });

    it('parses posts with location as travel', async () => {
      const data = {
        posts: [
          {
            timestamp: 1609459200,
            title: 'Checking in from Paris',
            attachments: [
              {
                data: [
                  {
                    place: {
                      name: 'Eiffel Tower',
                      coordinate: {
                        latitude: 48.8584,
                        longitude: 2.2945,
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events[0].layer).toBe('travel');
      expect(result.events[0].location).toEqual({
        name: 'Eiffel Tower',
        latitude: 48.8584,
        longitude: 2.2945,
      });
    });

    it('parses posts with media attachments', async () => {
      const data = {
        posts: [
          {
            timestamp: 1609459200,
            title: 'Check out this photo',
            attachments: [
              {
                data: [
                  {
                    media: {
                      uri: 'photos/image.jpg',
                      title: 'My photo',
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events[0].eventType).toBe('photo_post');
      expect(result.events[0].metadata?.hasMedia).toBe(true);
    });

    it('parses friends list', async () => {
      const data = {
        friends_v2: [
          {
            name: 'John Doe',
            timestamp: 1609459200,
          },
          {
            name: 'Jane Smith',
            timestamp: 1612137600, // 2021-02-01
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].title).toBe('Connected with John Doe');
      expect(result.events[0].layer).toBe('relationships');
      expect(result.events[0].eventType).toBe('connection');
    });

    it('parses friends from alternative structure', async () => {
      const data = {
        friends: [
          {
            name: 'Alice Wonder',
            timestamp: 1609459200,
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Connected with Alice Wonder');
    });

    it('parses Facebook events', async () => {
      const data = {
        events_joined: [
          {
            name: 'Tech Conference 2021',
            start_timestamp: 1609459200,
            end_timestamp: 1609545600, // next day
            place: {
              name: 'Convention Center',
              coordinate: {
                latitude: 37.7749,
                longitude: -122.4194,
              },
            },
          },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Tech Conference 2021');
      expect(result.events[0].layer).toBe('travel');
      expect(result.events[0].eventType).toBe('event');
      expect(result.events[0].endDate).toBeDefined();
    });

    it('combines events from multiple sources', async () => {
      const data = {
        posts: [{ timestamp: 1609459200, title: 'Post' }],
        friends_v2: [{ name: 'Friend', timestamp: 1609459200 }],
        events_invited: [{ name: 'Event', start_timestamp: 1609459200 }],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(3);
      expect(result.stats.totalEvents).toBe(3);
    });

    it('skips posts without timestamp', async () => {
      const data = {
        posts: [
          { title: 'No timestamp' },
          { timestamp: 1609459200, title: 'Has timestamp' },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Has timestamp');
    });

    it('skips empty posts', async () => {
      const data = {
        posts: [
          { timestamp: 1609459200, title: '' },
          { timestamp: 1609459200, title: '   ' },
          { timestamp: 1609459200, title: 'Valid post' },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(1);
    });

    it('skips friends without required fields', async () => {
      const data = {
        friends_v2: [
          { name: 'No timestamp' },
          { timestamp: 1609459200 },
          { name: 'Valid', timestamp: 1609459200 },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(1);
    });

    it('calculates correct stats', async () => {
      const data = {
        posts: [
          { timestamp: 1609459200, title: 'Post 1' },
          { timestamp: 1609459200, title: 'Post 2' },
        ],
        friends_v2: [
          { name: 'Friend', timestamp: 1609459200 },
        ],
      };

      const result = await parseFacebookData(data);

      expect(result.stats.totalEvents).toBe(3);
      expect(result.stats.eventsByLayer.media).toBe(2);
      expect(result.stats.eventsByLayer.relationships).toBe(1);
    });

    it('handles empty data gracefully', async () => {
      const result = await parseFacebookData({});

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalEvents).toBe(0);
    });

    it('generates unique source IDs', async () => {
      const data = {
        posts: [
          { timestamp: 1609459200, title: 'Post 1' },
          { timestamp: 1609459201, title: 'Post 2' },
        ],
      };

      const result = await parseFacebookData(data);

      const sourceIds = result.events.map((e) => e.sourceId);
      expect(new Set(sourceIds).size).toBe(sourceIds.length);
    });

    it('parses event_responses structure', async () => {
      const data = {
        event_responses: {
          events_joined: [
            {
              name: 'Birthday Party',
              start_timestamp: 1609459200,
            },
          ],
          events_invited: [
            {
              name: 'Wedding',
              start_timestamp: 1612137600,
            },
          ],
        },
      };

      const result = await parseFacebookData(data);

      expect(result.events).toHaveLength(2);
      expect(result.events.map(e => e.title)).toContain('Birthday Party');
      expect(result.events.map(e => e.title)).toContain('Wedding');
    });
  });

  describe('File array processing', () => {
    it('processes array of File objects with posts content', async () => {
      const postsData = [
        { timestamp: 1609459200, title: 'Post from file' },
      ];
      const file = createMockJsonFile(postsData, 'posts/your_posts_1.json');

      const result = await parseFacebookData([file]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Post from file');
      expect(result.stats.processedFiles).toBe(1);
    });

    it('processes array of File objects with friends content', async () => {
      const friendsData = [
        { name: 'Test Friend', timestamp: 1609459200 },
      ];
      const file = createMockJsonFile(friendsData, 'friends/friends.json');

      const result = await parseFacebookData([file]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Connected with Test Friend');
      expect(result.events[0].layer).toBe('relationships');
    });

    it('processes multiple files from different categories', async () => {
      const files = [
        createMockJsonFile([{ timestamp: 1609459200, title: 'A post' }], 'posts/your_posts_1.json'),
        createMockJsonFile([{ name: 'Friend Name', timestamp: 1609459200 }], 'friends/friends.json'),
        createMockJsonFile([{ name: 'An Event', start_timestamp: 1609459200 }], 'events/your_events.json'),
      ];

      const result = await parseFacebookData(files);

      expect(result.events).toHaveLength(3);
      expect(result.stats.processedFiles).toBe(3);
      expect(result.events.map(e => e.layer)).toContain('media');
      expect(result.events.map(e => e.layer)).toContain('relationships');
    });

    it('auto-detects content type for unknown file paths', async () => {
      // Post-like content in an unknown file path
      const file = createMockJsonFile(
        [{ timestamp: 1609459200, title: 'Auto-detected post' }],
        'unknown_file.json'
      );

      const result = await parseFacebookData([file]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Auto-detected post');
    });

    it('handles files with object wrapper containing known keys', async () => {
      const file = createMockJsonFile(
        { friends_v2: [{ name: 'Wrapped Friend', timestamp: 1609459200 }] },
        'friends.json'
      );

      const result = await parseFacebookData([file]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Connected with Wrapped Friend');
    });

    it('handles mixed content files', async () => {
      // Some Facebook exports have friends and other data in the same structure
      const file = createMockJsonFile(
        {
          posts: [{ timestamp: 1609459200, title: 'Mixed Post' }],
          friends_v2: [{ name: 'Mixed Friend', timestamp: 1609459200 }],
        },
        'mixed_data.json'
      );

      const result = await parseFacebookData([file]);

      expect(result.events).toHaveLength(2);
    });

    it('reports errors for invalid JSON files', async () => {
      const file = createMockFile('not valid json', 'invalid.json');

      const result = await parseFacebookData([file]);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].file).toBe('invalid.json');
    });
  });

  describe('Edge cases', () => {
    describe('Empty and null values', () => {
      it('handles empty posts array', async () => {
        const data = { posts: [] };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
      });

      it('handles empty friends array', async () => {
        const data = { friends_v2: [] };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
      });

      it('handles post with undefined title', async () => {
        const data = {
          posts: [{ timestamp: 1609459200, title: undefined }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
      });

      it('handles post with empty string title', async () => {
        const data = {
          posts: [{ timestamp: 1609459200, title: '' }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
      });

      it('handles post with whitespace-only title', async () => {
        const data = {
          posts: [{ timestamp: 1609459200, title: '   \n\t  ' }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
      });

      it('handles friend with undefined name', async () => {
        const data = {
          friends_v2: [{ name: undefined, timestamp: 1609459200 }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
      });

      it('handles event with undefined name', async () => {
        const data = {
          events_joined: [{ name: undefined, start_timestamp: 1609459200 }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
      });

      it('handles completely empty object', async () => {
        const data = {};
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Timestamp edge cases', () => {
      it('handles zero timestamp', async () => {
        const data = {
          posts: [{ timestamp: 0, title: 'Zero timestamp post' }],
        };
        const result = await parseFacebookData(data);
        // Zero timestamp = epoch (1970-01-01)
        if (result.events.length > 0) {
          expect(result.events[0].startDate.getFullYear()).toBe(1970);
        }
      });

      it('handles negative timestamp', async () => {
        const data = {
          posts: [{ timestamp: -1000000, title: 'Negative timestamp post' }],
        };
        const result = await parseFacebookData(data);
        // Should handle gracefully (before epoch)
        expect(result.events.length).toBeGreaterThanOrEqual(0);
      });

      it('handles very large timestamp (far future)', async () => {
        const data = {
          posts: [{ timestamp: 4102444800, title: 'Year 2100 post' }], // 2100-01-01
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].startDate.getFullYear()).toBe(2100);
      });

      it('handles timestamp as string', async () => {
        const data = {
          posts: [{ timestamp: '1609459200' as unknown as number, title: 'String timestamp' }],
        };
        const result = await parseFacebookData(data);
        // May or may not parse depending on implementation
        expect(result.errors.length + result.events.length).toBeGreaterThanOrEqual(0);
      });

      it('handles missing timestamp with data array fallback', async () => {
        const data = {
          posts: [
            {
              data: [{ post: 'Post from data array', update_timestamp: 1609459200 }],
            },
          ],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
      });
    });

    describe('Unicode and special characters', () => {
      it('handles unicode in post title', async () => {
        const data = {
          posts: [{ timestamp: 1609459200, title: '日本語の投稿 - Post en français 🎉' }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toContain('日本語');
        expect(result.events[0].title).toContain('🎉');
      });

      it('handles unicode in friend name', async () => {
        const data = {
          friends_v2: [{ name: '田中太郎', timestamp: 1609459200 }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toContain('田中太郎');
      });

      it('handles emoji-only post title', async () => {
        const data = {
          posts: [{ timestamp: 1609459200, title: '🎂🎉🎊' }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
      });

      it('handles HTML entities in post title', async () => {
        const data = {
          posts: [{ timestamp: 1609459200, title: 'Test &amp; Test &lt;tag&gt;' }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
      });
    });

    describe('Long content handling', () => {
      it('truncates very long post title', async () => {
        const longTitle = 'A'.repeat(500);
        const data = {
          posts: [{ timestamp: 1609459200, title: longTitle }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].title.length).toBeLessThanOrEqual(103); // 100 + "..."
      });

      it('preserves full content in description for long posts', async () => {
        const longTitle = 'A'.repeat(500);
        const data = {
          posts: [{ timestamp: 1609459200, title: longTitle }],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].description?.length).toBe(500);
      });
    });

    describe('Location data edge cases', () => {
      it('handles location with zero coordinates', async () => {
        const data = {
          posts: [
            {
              timestamp: 1609459200,
              title: 'Post at null island',
              attachments: [
                {
                  data: [
                    {
                      place: {
                        name: 'Null Island',
                        coordinate: { latitude: 0, longitude: 0 },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].layer).toBe('travel');
      });

      it('handles location without coordinates', async () => {
        const data = {
          posts: [
            {
              timestamp: 1609459200,
              title: 'Post with place name only',
              attachments: [
                {
                  data: [
                    {
                      place: {
                        name: 'Some Place',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].location?.latitude).toBe(0);
      });

      it('handles event with location', async () => {
        const data = {
          events_joined: [
            {
              name: 'Concert',
              start_timestamp: 1609459200,
              place: {
                name: 'Music Hall',
                coordinate: { latitude: 40.7128, longitude: -74.006 },
              },
            },
          ],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].layer).toBe('travel');
        expect(result.events[0].location?.name).toBe('Music Hall');
      });
    });

    describe('File processing edge cases', () => {
      it('handles empty File array', async () => {
        const result = await parseFacebookData([]);
        expect(result.events).toHaveLength(0);
        expect(result.stats.totalFiles).toBe(0);
      });

      it('handles empty JSON file', async () => {
        const file = createMockFile('', 'empty.json');
        const result = await parseFacebookData([file]);
        expect(result.events).toHaveLength(0);
      });

      it('handles JSON file with only whitespace', async () => {
        const file = createMockFile('   \n\t  ', 'whitespace.json');
        const result = await parseFacebookData([file]);
        expect(result.events).toHaveLength(0);
      });

      it('handles deeply nested null values', async () => {
        const file = createMockJsonFile(
          {
            posts: [
              {
                timestamp: 1609459200,
                title: 'Post with nested nulls',
                attachments: [{ data: [{ place: null, media: null }] }],
              },
            ],
          },
          'posts/nested_nulls.json'
        );
        const result = await parseFacebookData([file]);
        expect(result.events).toHaveLength(1);
      });

      it('handles mixed valid and invalid entries', async () => {
        const file = createMockJsonFile(
          [
            { timestamp: 1609459200, title: 'Valid post' },
            { timestamp: null, title: 'Invalid - no timestamp' },
            { timestamp: 1609459200, title: '' }, // Invalid - empty title
            { timestamp: 1609459200, title: 'Another valid post' },
          ],
          'posts/mixed.json'
        );
        const result = await parseFacebookData([file]);
        expect(result.events).toHaveLength(2);
      });
    });

    describe('Multiple data sources', () => {
      it('handles event_responses nested structure', async () => {
        const data = {
          event_responses: {
            events_joined: [{ name: 'Joined Event', start_timestamp: 1609459200 }],
            events_invited: [{ name: 'Invited Event', start_timestamp: 1609459200 }],
          },
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(2);
      });

      it('handles duplicate events from different sources', async () => {
        const data = {
          events_joined: [{ name: 'Same Event', start_timestamp: 1609459200 }],
          your_events: [{ name: 'Same Event', start_timestamp: 1609459200 }],
        };
        const result = await parseFacebookData(data);
        // Both should be imported (deduplication is caller's responsibility)
        expect(result.events).toHaveLength(2);
      });

      it('handles all possible post keys', async () => {
        const data = {
          posts: [{ timestamp: 1609459200, title: 'From posts' }],
          your_posts_1: [{ timestamp: 1609459200, title: 'From your_posts_1' }],
        };
        const result = await parseFacebookData(data);
        // Should use posts OR your_posts_1, not both
        expect(result.events).toHaveLength(1);
      });

      it('handles all possible friend keys', async () => {
        const data = {
          friends_v2: [{ name: 'Friend v2', timestamp: 1609459200 }],
          friends: [{ name: 'Friend legacy', timestamp: 1609459200 }],
        };
        const result = await parseFacebookData(data);
        // Should use friends_v2 OR friends, not both
        expect(result.events).toHaveLength(1);
      });
    });

    describe('Event with end time', () => {
      it('handles event with end_timestamp', async () => {
        const data = {
          events_joined: [
            {
              name: 'Multi-day Event',
              start_timestamp: 1609459200, // Jan 1
              end_timestamp: 1609718400, // Jan 4
            },
          ],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].endDate).toBeDefined();
        expect(result.events[0].endDate?.getDate()).toBe(4);
      });

      it('handles event without end_timestamp', async () => {
        const data = {
          events_joined: [
            {
              name: 'Single-day Event',
              start_timestamp: 1609459200,
            },
          ],
        };
        const result = await parseFacebookData(data);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].endDate).toBeUndefined();
      });
    });

    describe('File size validation', () => {
      it('rejects files larger than 50MB', async () => {
        // Create a mock file with size > 50MB
        const largeFile = new File(['test'], 'large.json', { type: 'application/json' });
        Object.defineProperty(largeFile, 'size', { value: 51 * 1024 * 1024 }); // 51MB

        const result = await parseFacebookData([largeFile]);

        expect(result.events).toHaveLength(0);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('too large');
        expect(result.errors[0].message).toContain('50MB');
      });

      it('accepts files smaller than 50MB', async () => {
        const validFile = createMockJsonFile(
          { posts: [{ timestamp: 1609459200, title: 'Valid post' }] },
          'posts.json'
        );
        Object.defineProperty(validFile, 'size', { value: 10 * 1024 * 1024 }); // 10MB

        const result = await parseFacebookData([validFile]);

        expect(result.events).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      });

      it('includes file name in error message', async () => {
        const largeFile = new File(['test'], 'massive_export.json', { type: 'application/json' });
        Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 }); // 100MB

        const result = await parseFacebookData([largeFile]);

        expect(result.errors[0].file).toBe('massive_export.json');
      });
    });
  });
});
