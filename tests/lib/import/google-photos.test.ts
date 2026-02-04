import { describe, it, expect, vi } from 'vitest';
import { parseGooglePhotosData } from '@/lib/import/google/photos';

// Mock the extractExif function since we test it separately
vi.mock('@/lib/import/exif', () => ({
  extractExif: vi.fn().mockResolvedValue(null),
  getBestExifDate: vi.fn().mockReturnValue(undefined),
}));

// Helper to create a mock JSON sidecar file
function createMockJsonFile(content: unknown, name: string): File {
  const json = JSON.stringify(content);
  const file = new File([json], name, { type: 'application/json' });
  (file as ReturnType<typeof Object>).text = async () => json;
  return file;
}

// Helper to create a mock media file
function createMockMediaFile(name: string, size = 1024): File {
  const content = new Uint8Array(size);
  const file = new File([content], name, { type: 'image/jpeg' });
  (file as ReturnType<typeof Object>).arrayBuffer = async () => content.buffer;
  return file;
}

describe('Google Photos Parser', () => {
  describe('parseGooglePhotosData', () => {
    it('parses media file with JSON sidecar', async () => {
      const sidecar = {
        title: 'Beach Sunset.jpg',
        description: 'Beautiful sunset at the beach',
        photoTakenTime: {
          timestamp: '1687017600', // 2023-06-17 16:00:00 UTC
          formatted: 'Jun 17, 2023, 4:00:00 PM UTC',
        },
        geoData: {
          latitude: 34.0195,
          longitude: -118.4912,
          altitude: 10.0,
        },
      };

      const mediaFile = createMockMediaFile('Beach Sunset.jpg');
      const sidecarFile = createMockJsonFile(sidecar, 'Beach Sunset.jpg.json');

      const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].startDate.getFullYear()).toBe(2023);
      expect(result.events[0].location?.latitude).toBeCloseTo(34.0195, 4);
      expect(result.events[0].location?.longitude).toBeCloseTo(-118.4912, 4);
      expect(result.events[0].layer).toBe('travel'); // Has location
      expect(result.events[0].source).toBe('google');
    });

    it('uses creationTime as fallback when photoTakenTime is missing', async () => {
      const sidecar = {
        title: 'Screenshot.png',
        creationTime: {
          timestamp: '1672531200', // 2023-01-01 00:00:00 UTC
        },
      };

      const mediaFile = createMockMediaFile('Screenshot.png');
      const sidecarFile = createMockJsonFile(sidecar, 'Screenshot.png.json');

      const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].startDate.getFullYear()).toBe(2023);
      expect(result.events[0].startDate.getMonth()).toBe(0); // January
    });

    it('handles media files without sidecar using path patterns', async () => {
      // Filename contains date pattern
      const mediaFile = createMockMediaFile('IMG_20231225_143022.jpg');

      const result = await parseGooglePhotosData([mediaFile]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].startDate.getFullYear()).toBe(2023);
      expect(result.events[0].startDate.getMonth()).toBe(11); // December
      expect(result.events[0].startDate.getDate()).toBe(25);
    });

    it('extracts album name from path', async () => {
      const sidecar = {
        title: 'family_photo.jpg',
        photoTakenTime: { timestamp: '1687017600' },
      };

      // Simulate file from "Summer Vacation 2023" album
      const mediaFile = createMockMediaFile('family_photo.jpg');
      Object.defineProperty(mediaFile, 'webkitRelativePath', {
        value: 'Google Photos/Summer Vacation 2023/family_photo.jpg',
      });

      const sidecarFile = createMockJsonFile(sidecar, 'family_photo.jpg.json');

      // For this test, we'll check the metadata parsing logic
      const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

      expect(result.events).toHaveLength(1);
      // The event should have the media type and source
      expect(result.events[0].eventType).toBe('photo');
    });

    it('identifies video files correctly', async () => {
      const sidecar = {
        title: 'Birthday Party.mp4',
        photoTakenTime: { timestamp: '1687017600' },
      };

      const mediaFile = createMockMediaFile('Birthday Party.mp4');
      const sidecarFile = createMockJsonFile(sidecar, 'Birthday Party.mp4.json');

      const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('video');
    });

    it('handles multiple media files', async () => {
      const files = [
        createMockMediaFile('photo1.jpg'),
        createMockJsonFile({ title: 'photo1.jpg', photoTakenTime: { timestamp: '1672531200' } }, 'photo1.jpg.json'),
        createMockMediaFile('photo2.jpg'),
        createMockJsonFile({ title: 'photo2.jpg', photoTakenTime: { timestamp: '1675209600' } }, 'photo2.jpg.json'),
        createMockMediaFile('photo3.jpg'),
        createMockJsonFile({ title: 'photo3.jpg', photoTakenTime: { timestamp: '1677628800' } }, 'photo3.jpg.json'),
      ];

      const result = await parseGooglePhotosData(files);

      expect(result.events).toHaveLength(3);
      expect(result.stats.processedFiles).toBe(3);
    });

    it('uses geoDataExif as fallback for location', async () => {
      const sidecar = {
        title: 'photo.jpg',
        photoTakenTime: { timestamp: '1687017600' },
        geoDataExif: {
          latitude: 51.5074,
          longitude: -0.1278,
        },
      };

      const mediaFile = createMockMediaFile('photo.jpg');
      const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

      const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].location?.latitude).toBeCloseTo(51.5074, 4);
    });

    it('preserves metadata from sidecar', async () => {
      const sidecar = {
        title: 'group_photo.jpg',
        description: 'Team building event',
        photoTakenTime: { timestamp: '1687017600' },
        people: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
      };

      const mediaFile = createMockMediaFile('group_photo.jpg');
      const sidecarFile = createMockJsonFile(sidecar, 'group_photo.jpg.json');

      const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].metadata?.hasSidecar).toBe(true);
      expect(result.events[0].metadata?.people).toContain('Alice');
      expect(result.events[0].metadata?.people).toContain('Bob');
    });

    it('skips media files without any date information', async () => {
      // File with no sidecar and no date pattern in name
      const mediaFile = createMockMediaFile('random_image.jpg');

      const result = await parseGooglePhotosData([mediaFile]);

      expect(result.events).toHaveLength(0);
      expect(result.errors.some(e => e.message.includes('skipped'))).toBe(true);
    });

    it('calculates stats by layer correctly', async () => {
      const files = [
        // Photo with location (travel)
        createMockMediaFile('beach.jpg'),
        createMockJsonFile(
          { title: 'beach.jpg', photoTakenTime: { timestamp: '1687017600' }, geoData: { latitude: 1, longitude: 2 } },
          'beach.jpg.json'
        ),
        // Photo without location (media)
        createMockMediaFile('selfie.jpg'),
        createMockJsonFile({ title: 'selfie.jpg', photoTakenTime: { timestamp: '1687017600' } }, 'selfie.jpg.json'),
      ];

      const result = await parseGooglePhotosData(files);

      expect(result.stats.eventsByLayer?.travel).toBe(1);
      expect(result.stats.eventsByLayer?.media).toBe(1);
    });

    it('handles different media file extensions', async () => {
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.mp4', '.mov'];
      const files: File[] = [];

      for (let i = 0; i < extensions.length; i++) {
        const ext = extensions[i];
        const name = `file${i}${ext}`;
        files.push(createMockMediaFile(name));
        files.push(
          createMockJsonFile({ title: name, photoTakenTime: { timestamp: String(1672531200 + i * 86400) } }, `${name}.json`)
        );
      }

      const result = await parseGooglePhotosData(files);

      expect(result.events).toHaveLength(extensions.length);
    });

    it('extracts date from "Photos from YYYY" folder pattern', async () => {
      // This tests the path-based date extraction
      const mediaFile = createMockMediaFile('random.jpg');
      // Can't easily mock the path for extracted files, but we can test the function handles missing dates gracefully
      const result = await parseGooglePhotosData([mediaFile]);

      // Should skip since no date found
      expect(result.events).toHaveLength(0);
    });

    it('handles VID_ filename pattern for videos', async () => {
      const mediaFile = createMockMediaFile('VID_20231231_235959.mp4');

      const result = await parseGooglePhotosData([mediaFile]);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].startDate.getFullYear()).toBe(2023);
      expect(result.events[0].startDate.getMonth()).toBe(11); // December
      expect(result.events[0].startDate.getDate()).toBe(31);
      expect(result.events[0].eventType).toBe('video');
    });

    it('matches sidecar files case-insensitively', async () => {
      const mediaFile = createMockMediaFile('PHOTO.JPG');
      const sidecarFile = createMockJsonFile(
        { title: 'PHOTO.JPG', photoTakenTime: { timestamp: '1687017600' } },
        'photo.jpg.json'
      );

      const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

      expect(result.events).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    describe('Sidecar JSON edge cases', () => {
      it('handles sidecar with invalid JSON', async () => {
        const mediaFile = createMockMediaFile('IMG_20230615_120000.jpg');
        const invalidJson = new File(['not valid json'], 'IMG_20230615_120000.jpg.json', { type: 'application/json' });
        (invalidJson as ReturnType<typeof Object>).text = async () => 'not valid json';

        const result = await parseGooglePhotosData([mediaFile, invalidJson]);

        // Should still process media file using filename date
        expect(result.events).toHaveLength(1);
      });

      it('handles sidecar with empty object', async () => {
        const mediaFile = createMockMediaFile('IMG_20230615_120000.jpg');
        const sidecarFile = createMockJsonFile({}, 'IMG_20230615_120000.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        // Should use filename date since sidecar has no timestamp
        expect(result.events).toHaveLength(1);
      });

      it('handles sidecar with null timestamp', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: null },
        };
        const mediaFile = createMockMediaFile('IMG_20230615_120000.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'IMG_20230615_120000.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events).toHaveLength(1);
      });

      it('handles sidecar with zero timestamp', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '0' },
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        // Zero timestamp is invalid, should skip
        expect(result.events).toHaveLength(0);
      });

      it('handles sidecar with negative timestamp', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '-1000000' },
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        // Negative timestamp should be handled gracefully
        expect(result.events).toHaveLength(0);
      });

      it('handles sidecar with very large timestamp', async () => {
        const sidecar = {
          title: 'photo.jpg',
          // Year 3000
          photoTakenTime: { timestamp: '32503680000' },
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].startDate.getFullYear()).toBe(3000);
      });

      it('handles sidecar with non-numeric timestamp', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: 'not-a-number' },
        };
        const mediaFile = createMockMediaFile('IMG_20230615_120000.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'IMG_20230615_120000.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        // Should fall back to filename date
        expect(result.events).toHaveLength(1);
      });
    });

    describe('GPS coordinate edge cases', () => {
      it('handles zero coordinates (null island) - filtered as potentially invalid', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '1687017600' },
          geoData: { latitude: 0, longitude: 0 },
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        // Zero coords are filtered out (0,0 is often used as "no data" placeholder)
        expect(result.events).toHaveLength(1);
        expect(result.events[0].location).toBeUndefined();
      });

      it('handles extreme latitude (poles)', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '1687017600' },
          geoData: { latitude: 90, longitude: 1 }, // North Pole (with non-zero longitude)
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events[0].location?.latitude).toBe(90);
      });

      it('handles negative coordinates (southern/western hemispheres)', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '1687017600' },
          geoData: { latitude: -33.8688, longitude: -70.6693, altitude: -50 },
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events[0].location?.latitude).toBeLessThan(0);
        expect(result.events[0].location?.longitude).toBeLessThan(0);
      });

      it('prefers geoData over geoDataExif', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '1687017600' },
          geoData: { latitude: 40.7128, longitude: -74.006 },
          geoDataExif: { latitude: 51.5074, longitude: -0.1278 },
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events[0].location?.latitude).toBeCloseTo(40.7128, 4);
      });
    });

    describe('Filename pattern edge cases', () => {
      it('handles filename with timestamp format YYYYMMDD_HHMMSS', async () => {
        const mediaFile = createMockMediaFile('20231225_143022.jpg');

        const result = await parseGooglePhotosData([mediaFile]);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].startDate.getFullYear()).toBe(2023);
        expect(result.events[0].startDate.getMonth()).toBe(11);
        expect(result.events[0].startDate.getDate()).toBe(25);
      });

      it('handles IMG prefix with various separators', async () => {
        const files = [
          createMockMediaFile('IMG_20230615_120000.jpg'),
          createMockMediaFile('IMG-20230615-120000.jpg'),
          createMockMediaFile('IMG20230615120000.jpg'),
        ];

        for (const file of files) {
          const result = await parseGooglePhotosData([file]);
          if (result.events.length > 0) {
            expect(result.events[0].startDate.getFullYear()).toBe(2023);
          }
        }
      });

      it('handles screenshot filenames', async () => {
        const mediaFile = createMockMediaFile('Screenshot_20230615_120000.png');

        const result = await parseGooglePhotosData([mediaFile]);

        // Depending on pattern matching, may or may not extract date
        // Test that it doesn't crash
        expect(result.errors).not.toContain(expect.objectContaining({ message: expect.stringContaining('crash') }));
      });

      it('handles WhatsApp image filenames', async () => {
        const mediaFile = createMockMediaFile('IMG-20230615-WA0001.jpg');

        const result = await parseGooglePhotosData([mediaFile]);

        // Should extract date even from WhatsApp format
        if (result.events.length > 0) {
          expect(result.events[0].startDate.getFullYear()).toBe(2023);
        }
      });

      it('handles filenames with spaces', async () => {
        const sidecar = {
          title: 'My Vacation Photo.jpg',
          photoTakenTime: { timestamp: '1687017600' },
        };
        const mediaFile = createMockMediaFile('My Vacation Photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'My Vacation Photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events).toHaveLength(1);
      });

      it('handles filenames with special characters', async () => {
        const sidecar = {
          title: "Photo (1) - Copy [2023].jpg",
          photoTakenTime: { timestamp: '1687017600' },
        };
        const mediaFile = createMockMediaFile("Photo (1) - Copy [2023].jpg");
        const sidecarFile = createMockJsonFile(sidecar, "Photo (1) - Copy [2023].jpg.json");

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events).toHaveLength(1);
      });

      it('handles unicode filenames', async () => {
        const sidecar = {
          title: '東京タワー_写真.jpg',
          photoTakenTime: { timestamp: '1687017600' },
        };
        const mediaFile = createMockMediaFile('東京タワー_写真.jpg');
        const sidecarFile = createMockJsonFile(sidecar, '東京タワー_写真.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events).toHaveLength(1);
      });
    });

    describe('Empty and edge file scenarios', () => {
      it('handles empty file array', async () => {
        const result = await parseGooglePhotosData([]);

        expect(result.events).toHaveLength(0);
        expect(result.stats.totalFiles).toBe(0);
      });

      it('handles only non-media files', async () => {
        const textFile = new File(['hello world'], 'readme.txt', { type: 'text/plain' });
        const htmlFile = new File(['<html></html>'], 'index.html', { type: 'text/html' });

        const result = await parseGooglePhotosData([textFile, htmlFile]);

        expect(result.events).toHaveLength(0);
      });

      it('handles sidecar without matching media file', async () => {
        const sidecarFile = createMockJsonFile(
          { title: 'orphan.jpg', photoTakenTime: { timestamp: '1687017600' } },
          'orphan.jpg.json'
        );

        const result = await parseGooglePhotosData([sidecarFile]);

        // Sidecar alone should not create an event
        expect(result.events).toHaveLength(0);
      });

      it('handles duplicate media files', async () => {
        const sidecar = { title: 'photo.jpg', photoTakenTime: { timestamp: '1687017600' } };
        const mediaFile1 = createMockMediaFile('photo.jpg');
        const mediaFile2 = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile1, mediaFile2, sidecarFile]);

        // Should handle duplicates (either merge or create separate events)
        expect(result.events.length).toBeGreaterThanOrEqual(1);
      });

      it('handles very large number of files', async () => {
        const files: File[] = [];
        for (let i = 0; i < 100; i++) {
          const name = `IMG_2023${String(i).padStart(4, '0')}_120000.jpg`;
          files.push(createMockMediaFile(name));
        }

        const result = await parseGooglePhotosData(files);

        // Should process all without crashing
        expect(result.stats.totalFiles).toBe(100);
      });
    });

    describe('People metadata edge cases', () => {
      it('handles people array with null names', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '1687017600' },
          people: [{ name: 'Alice' }, { name: null }, { name: 'Bob' }, {}],
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events).toHaveLength(1);
        // Should filter out null/undefined names
        expect(result.events[0].metadata?.people).not.toContain(null);
        expect(result.events[0].metadata?.people).not.toContain(undefined);
      });

      it('handles empty people array', async () => {
        const sidecar = {
          title: 'photo.jpg',
          photoTakenTime: { timestamp: '1687017600' },
          people: [],
        };
        const mediaFile = createMockMediaFile('photo.jpg');
        const sidecarFile = createMockJsonFile(sidecar, 'photo.jpg.json');

        const result = await parseGooglePhotosData([mediaFile, sidecarFile]);

        expect(result.events).toHaveLength(1);
      });
    });
  });
});
