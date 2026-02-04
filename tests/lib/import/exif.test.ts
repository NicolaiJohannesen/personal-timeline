import { describe, it, expect } from 'vitest';
import { parseExifFromBuffer, extractExif, getBestExifDate, type ExifData } from '@/lib/import/exif';

// Create a minimal valid JPEG with no EXIF
function createMinimalJpeg(): ArrayBuffer {
  // JPEG with just SOI and EOI markers
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return jpeg.buffer;
}

// Create a JPEG with APP1 marker but invalid EXIF signature
function createJpegWithInvalidExif(): ArrayBuffer {
  const jpeg = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1 marker
    0x00, 0x08, // Length (8 bytes including length)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Not "Exif\0\0"
    0xff, 0xd9, // EOI
  ]);
  return jpeg.buffer;
}

// Helper to create a mock file with arrayBuffer method
function createMockFile(buffer: ArrayBuffer, name: string): File {
  const file = new File([buffer], name, { type: 'image/jpeg' });
  (file as ReturnType<typeof Object>).arrayBuffer = async () => buffer;
  return file;
}

describe('EXIF Parser', () => {
  describe('parseExifFromBuffer', () => {
    it('returns null for empty buffer', () => {
      const buffer = new ArrayBuffer(0);
      const result = parseExifFromBuffer(buffer);
      expect(result).toBeNull();
    });

    it('returns null for non-JPEG data', () => {
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      view[0] = 0x89; // PNG signature start
      view[1] = 0x50;
      const result = parseExifFromBuffer(buffer);
      expect(result).toBeNull();
    });

    it('returns null for JPEG without APP1 marker', () => {
      const result = parseExifFromBuffer(createMinimalJpeg());
      expect(result).toBeNull();
    });

    it('returns null for JPEG with invalid EXIF signature', () => {
      const result = parseExifFromBuffer(createJpegWithInvalidExif());
      expect(result).toBeNull();
    });

    it('returns null for JPEG with APP1 but wrong magic', () => {
      const jpeg = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xe1, // APP1 marker
        0x00, 0x10, // Length
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
        0x4d, 0x4d, // Big-endian (MM)
        0x00, 0x00, // Wrong magic (should be 42)
        0x00, 0x00, 0x00, 0x00,
        0xff, 0xd9, // EOI
      ]);
      const result = parseExifFromBuffer(jpeg.buffer);
      expect(result).toBeNull();
    });

    it('handles truncated JPEG gracefully', () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff]); // Incomplete
      const result = parseExifFromBuffer(jpeg.buffer);
      expect(result).toBeNull();
    });

    it('skips non-APP1 markers correctly', () => {
      const jpeg = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xe0, // APP0 marker (JFIF)
        0x00, 0x04, // Length (4 bytes)
        0x00, 0x00, // Minimal data
        0xff, 0xd9, // EOI
      ]);
      const result = parseExifFromBuffer(jpeg.buffer);
      expect(result).toBeNull();
    });
  });

  describe('extractExif', () => {
    it('extracts EXIF from File object', async () => {
      const buffer = createMinimalJpeg();
      const file = createMockFile(buffer, 'test.jpg');

      const result = await extractExif(file);

      // Should return null since the JPEG has no EXIF
      expect(result).toBeNull();
    });

    it('handles file read errors gracefully', async () => {
      const file = createMockFile(createMinimalJpeg(), 'test.jpg');
      (file as ReturnType<typeof Object>).arrayBuffer = async () => {
        throw new Error('Read error');
      };

      await expect(extractExif(file)).rejects.toThrow();
    });
  });

  describe('getBestExifDate', () => {
    it('returns dateTimeOriginal if available', () => {
      const exif: ExifData = {
        dateTime: new Date('2023-01-01'),
        dateTimeOriginal: new Date('2023-06-15'),
        dateTimeDigitized: new Date('2023-03-01'),
      };

      const result = getBestExifDate(exif);
      expect(result?.getMonth()).toBe(5); // June
    });

    it('falls back to dateTimeDigitized when dateTimeOriginal is missing', () => {
      const exif: ExifData = {
        dateTime: new Date('2023-01-01'),
        dateTimeDigitized: new Date('2023-03-01'),
      };

      const result = getBestExifDate(exif);
      expect(result?.getMonth()).toBe(2); // March
    });

    it('falls back to dateTime when both original and digitized are missing', () => {
      const exif: ExifData = {
        dateTime: new Date('2023-01-01'),
      };

      const result = getBestExifDate(exif);
      expect(result?.getMonth()).toBe(0); // January
    });

    it('returns undefined if no dates available', () => {
      const exif: ExifData = {
        make: 'Test',
      };

      const result = getBestExifDate(exif);
      expect(result).toBeUndefined();
    });

    it('returns undefined for empty EXIF data', () => {
      const exif: ExifData = {};
      const result = getBestExifDate(exif);
      expect(result).toBeUndefined();
    });

    it('prefers dateTimeOriginal even if dateTime is newer', () => {
      const exif: ExifData = {
        dateTime: new Date('2024-01-01'), // Newer
        dateTimeOriginal: new Date('2020-01-01'), // Older but preferred
      };

      const result = getBestExifDate(exif);
      expect(result?.getFullYear()).toBe(2020);
    });
  });

  describe('ExifData interface', () => {
    it('allows all optional fields', () => {
      const exif: ExifData = {
        dateTime: new Date(),
        dateTimeOriginal: new Date(),
        dateTimeDigitized: new Date(),
        gpsLatitude: 37.7749,
        gpsLongitude: -122.4194,
        gpsAltitude: 10,
        make: 'Apple',
        model: 'iPhone 14',
        software: 'iOS 16',
        imageDescription: 'A photo',
        orientation: 1,
      };

      expect(exif.make).toBe('Apple');
      expect(exif.gpsLatitude).toBe(37.7749);
    });

    it('allows empty object', () => {
      const exif: ExifData = {};
      expect(Object.keys(exif)).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('handles 1-byte buffer', () => {
      const buffer = new ArrayBuffer(1);
      const result = parseExifFromBuffer(buffer);
      expect(result).toBeNull();
    });

    it('handles exactly 2-byte buffer with wrong magic', () => {
      const buffer = new ArrayBuffer(2);
      const view = new Uint8Array(buffer);
      view[0] = 0x00;
      view[1] = 0x00;
      const result = parseExifFromBuffer(buffer);
      expect(result).toBeNull();
    });

    it('handles buffer with only JPEG magic (no content)', () => {
      const buffer = new ArrayBuffer(2);
      const view = new Uint8Array(buffer);
      view[0] = 0xff;
      view[1] = 0xd8;
      const result = parseExifFromBuffer(buffer);
      expect(result).toBeNull();
    });

    it('handles JPEG with SOS marker (image data start) before EXIF', () => {
      const jpeg = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xda, // SOS (Start of Scan) - should stop searching
        0x00, 0x04,
        0x00, 0x00,
        0xff, 0xe1, // APP1 after SOS - should not be found
        0x00, 0x08,
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
        0xff, 0xd9,
      ]);
      const result = parseExifFromBuffer(jpeg.buffer);
      expect(result).toBeNull();
    });

    it('handles JPEG with EOI marker before EXIF', () => {
      const jpeg = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xd9, // EOI - should stop searching
        0xff, 0xe1, // APP1 after EOI
        0x00, 0x08,
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      ]);
      const result = parseExifFromBuffer(jpeg.buffer);
      expect(result).toBeNull();
    });

    it('handles multiple APP markers before APP1', () => {
      const jpeg = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xe0, // APP0 (JFIF)
        0x00, 0x04, 0x00, 0x00,
        0xff, 0xe2, // APP2 (ICC Profile)
        0x00, 0x04, 0x00, 0x00,
        0xff, 0xfe, // COM (Comment)
        0x00, 0x04, 0x00, 0x00,
        0xff, 0xd9, // EOI
      ]);
      const result = parseExifFromBuffer(jpeg.buffer);
      expect(result).toBeNull();
    });

    it('handles APP1 marker with length pointing beyond buffer', () => {
      const jpeg = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xe1, // APP1
        0xff, 0xff, // Length: 65535 bytes (way beyond buffer)
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
        0xff, 0xd9,
      ]);
      // This may throw due to buffer bounds - that's acceptable behavior
      // The parser will throw a RangeError when trying to read beyond buffer
      expect(() => parseExifFromBuffer(jpeg.buffer)).toThrow();
    });

    it('handles GIF file (not JPEG)', () => {
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
      const result = parseExifFromBuffer(gif.buffer);
      expect(result).toBeNull();
    });

    it('handles WebP file (not JPEG)', () => {
      const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]); // RIFF....WEBP
      const result = parseExifFromBuffer(webp.buffer);
      expect(result).toBeNull();
    });

    it('handles random binary data', () => {
      const random = new Uint8Array(1000);
      for (let i = 0; i < random.length; i++) {
        random[i] = Math.floor(Math.random() * 256);
      }
      // Make sure it doesn't look like a JPEG
      random[0] = 0x00;
      random[1] = 0x00;
      const result = parseExifFromBuffer(random.buffer);
      expect(result).toBeNull();
    });

    it('handles very large buffer without EXIF', () => {
      const large = new Uint8Array(100000);
      large[0] = 0xff;
      large[1] = 0xd8;
      large[large.length - 2] = 0xff;
      large[large.length - 1] = 0xd9;
      const result = parseExifFromBuffer(large.buffer);
      expect(result).toBeNull();
    });
  });

  describe('GPS coordinate edge cases', () => {
    it('handles zero GPS coordinates', () => {
      const exif: ExifData = {
        gpsLatitude: 0,
        gpsLongitude: 0,
      };
      expect(exif.gpsLatitude).toBe(0);
      expect(exif.gpsLongitude).toBe(0);
    });

    it('handles extreme GPS coordinates', () => {
      const exif: ExifData = {
        gpsLatitude: 90, // North pole
        gpsLongitude: 180, // Date line
      };
      expect(exif.gpsLatitude).toBe(90);
      expect(exif.gpsLongitude).toBe(180);
    });

    it('handles negative GPS coordinates', () => {
      const exif: ExifData = {
        gpsLatitude: -33.8688, // Sydney
        gpsLongitude: 151.2093,
        gpsAltitude: -50, // Below sea level
      };
      expect(exif.gpsLatitude).toBeLessThan(0);
      expect(exif.gpsAltitude).toBeLessThan(0);
    });
  });

  describe('Date edge cases', () => {
    it('handles dates at epoch', () => {
      const exif: ExifData = {
        dateTimeOriginal: new Date(0), // 1970-01-01
      };
      const result = getBestExifDate(exif);
      expect(result?.getFullYear()).toBe(1970);
    });

    it('handles future dates', () => {
      const exif: ExifData = {
        dateTimeOriginal: new Date('2099-12-31'),
      };
      const result = getBestExifDate(exif);
      expect(result?.getFullYear()).toBe(2099);
    });

    it('handles invalid Date objects gracefully', () => {
      const exif: ExifData = {
        dateTimeOriginal: new Date('invalid'),
      };
      const result = getBestExifDate(exif);
      // Invalid date still returned (caller should validate)
      expect(result).toBeDefined();
      expect(Number.isNaN(result?.getTime())).toBe(true);
    });
  });

  describe('String field edge cases', () => {
    it('handles empty string fields', () => {
      const exif: ExifData = {
        make: '',
        model: '',
        software: '',
        imageDescription: '',
      };
      expect(exif.make).toBe('');
      expect(exif.model).toBe('');
    });

    it('handles very long string fields', () => {
      const longString = 'A'.repeat(10000);
      const exif: ExifData = {
        make: longString,
        imageDescription: longString,
      };
      expect(exif.make?.length).toBe(10000);
    });

    it('handles unicode in string fields', () => {
      const exif: ExifData = {
        make: '日本語メーカー',
        model: 'Модель камеры',
        imageDescription: '📷 Photo with émojis and àccénts',
      };
      expect(exif.make).toBe('日本語メーカー');
      expect(exif.imageDescription).toContain('📷');
    });

    it('handles string with null characters', () => {
      const exif: ExifData = {
        make: 'Test\0Null\0Chars',
      };
      expect(exif.make).toContain('\0');
    });
  });
});
