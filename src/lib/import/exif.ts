/**
 * EXIF metadata extractor for photos
 * Pure JavaScript implementation - no external dependencies
 * Extracts date, GPS coordinates, camera info from JPEG/TIFF images
 */

export interface ExifData {
  dateTime?: Date;
  dateTimeOriginal?: Date;
  dateTimeDigitized?: Date;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  make?: string;
  model?: string;
  software?: string;
  imageDescription?: string;
  orientation?: number;
}

// EXIF tag IDs
const TAGS = {
  // Image IFD
  IMAGE_DESCRIPTION: 0x010e,
  MAKE: 0x010f,
  MODEL: 0x0110,
  ORIENTATION: 0x0112,
  SOFTWARE: 0x0131,
  DATE_TIME: 0x0132,
  // EXIF Sub IFD
  EXIF_IFD_POINTER: 0x8769,
  GPS_INFO_IFD_POINTER: 0x8825,
  DATE_TIME_ORIGINAL: 0x9003,
  DATE_TIME_DIGITIZED: 0x9004,
  // GPS IFD
  GPS_LATITUDE_REF: 0x0001,
  GPS_LATITUDE: 0x0002,
  GPS_LONGITUDE_REF: 0x0003,
  GPS_LONGITUDE: 0x0004,
  GPS_ALTITUDE_REF: 0x0005,
  GPS_ALTITUDE: 0x0006,
} as const;

// Data type sizes
const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

// Security limits for EXIF parsing
const EXIF_MAX_IFD_ENTRIES = 500; // Maximum entries per IFD
const EXIF_MAX_STRING_LENGTH = 10_000; // Maximum string value length
const EXIF_MAX_ARRAY_LENGTH = 1000; // Maximum array value length

/**
 * Extract EXIF data from a file
 */
export async function extractExif(file: File): Promise<ExifData | null> {
  const buffer = await file.arrayBuffer();
  return parseExifFromBuffer(buffer);
}

/**
 * Extract EXIF data from an ArrayBuffer
 */
export function parseExifFromBuffer(buffer: ArrayBuffer): ExifData | null {
  // Need at least 2 bytes for JPEG magic
  if (buffer.byteLength < 2) {
    return null;
  }

  const view = new DataView(buffer);

  // Check for JPEG magic bytes (0xFFD8)
  if (view.getUint16(0) !== 0xffd8) {
    return null;
  }

  // Find APP1 marker with EXIF data
  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);

    // Check for APP1 marker (0xFFE1)
    if (marker === 0xffe1) {
      const length = view.getUint16(offset + 2);

      // Check for "Exif\0\0" signature
      if (
        view.getUint32(offset + 4) === 0x45786966 && // "Exif"
        view.getUint16(offset + 8) === 0x0000
      ) {
        // TIFF header starts after "Exif\0\0"
        const tiffOffset = offset + 10;
        return parseTiffData(view, tiffOffset);
      }

      offset += 2 + length;
    } else if ((marker & 0xff00) === 0xff00) {
      // Skip other markers
      if (marker === 0xffd9) break; // End of image
      if (marker === 0xffda) break; // Start of scan (image data)
      const length = view.getUint16(offset + 2);
      offset += 2 + length;
    } else {
      offset++;
    }
  }

  return null;
}

/**
 * Parse TIFF-formatted EXIF data
 */
function parseTiffData(view: DataView, tiffOffset: number): ExifData | null {
  // Check byte order
  const byteOrder = view.getUint16(tiffOffset);
  const littleEndian = byteOrder === 0x4949; // "II" = Intel = little-endian

  // Verify TIFF magic number (42)
  const magic = getUint16(view, tiffOffset + 2, littleEndian);
  if (magic !== 42) {
    return null;
  }

  // Get offset to first IFD
  const ifdOffset = getUint32(view, tiffOffset + 4, littleEndian);

  const exifData: ExifData = {};

  // Parse IFD0 (main image IFD)
  let exifIfdOffset: number | null = null;
  let gpsIfdOffset: number | null = null;

  parseIfd(view, tiffOffset, tiffOffset + ifdOffset, littleEndian, (tag, value) => {
    switch (tag) {
      case TAGS.IMAGE_DESCRIPTION:
        exifData.imageDescription = value as string;
        break;
      case TAGS.MAKE:
        exifData.make = value as string;
        break;
      case TAGS.MODEL:
        exifData.model = value as string;
        break;
      case TAGS.ORIENTATION:
        exifData.orientation = value as number;
        break;
      case TAGS.SOFTWARE:
        exifData.software = value as string;
        break;
      case TAGS.DATE_TIME:
        exifData.dateTime = parseExifDate(value as string);
        break;
      case TAGS.EXIF_IFD_POINTER:
        exifIfdOffset = value as number;
        break;
      case TAGS.GPS_INFO_IFD_POINTER:
        gpsIfdOffset = value as number;
        break;
    }
  });

  // Parse EXIF Sub IFD
  if (exifIfdOffset !== null) {
    parseIfd(view, tiffOffset, tiffOffset + exifIfdOffset, littleEndian, (tag, value) => {
      switch (tag) {
        case TAGS.DATE_TIME_ORIGINAL:
          exifData.dateTimeOriginal = parseExifDate(value as string);
          break;
        case TAGS.DATE_TIME_DIGITIZED:
          exifData.dateTimeDigitized = parseExifDate(value as string);
          break;
      }
    });
  }

  // Parse GPS IFD
  if (gpsIfdOffset !== null) {
    let latRef: string | null = null;
    let lat: number[] | null = null;
    let lonRef: string | null = null;
    let lon: number[] | null = null;
    let altRef: number | null = null;
    let alt: number | null = null;

    parseIfd(view, tiffOffset, tiffOffset + gpsIfdOffset, littleEndian, (tag, value) => {
      switch (tag) {
        case TAGS.GPS_LATITUDE_REF:
          latRef = value as string;
          break;
        case TAGS.GPS_LATITUDE:
          lat = value as number[];
          break;
        case TAGS.GPS_LONGITUDE_REF:
          lonRef = value as string;
          break;
        case TAGS.GPS_LONGITUDE:
          lon = value as number[];
          break;
        case TAGS.GPS_ALTITUDE_REF:
          altRef = value as number;
          break;
        case TAGS.GPS_ALTITUDE:
          alt = value as number;
          break;
      }
    });

    // Convert GPS coordinates
    if (lat && latRef) {
      exifData.gpsLatitude = convertGpsCoordinate(lat, latRef === 'S');
    }
    if (lon && lonRef) {
      exifData.gpsLongitude = convertGpsCoordinate(lon, lonRef === 'W');
    }
    if (alt !== null) {
      exifData.gpsAltitude = altRef === 1 ? -alt : alt;
    }
  }

  return exifData;
}

/**
 * Parse an IFD (Image File Directory) with security limits
 */
function parseIfd(
  view: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
  callback: (tag: number, value: unknown) => void
): void {
  try {
    // Bounds check for IFD offset
    if (ifdOffset < 0 || ifdOffset + 2 > view.byteLength) {
      return;
    }

    const numEntries = getUint16(view, ifdOffset, littleEndian);

    // Security: limit number of IFD entries
    const entriesToProcess = Math.min(numEntries, EXIF_MAX_IFD_ENTRIES);

    for (let i = 0; i < entriesToProcess; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;

      if (entryOffset + 12 > view.byteLength) break;

      const tag = getUint16(view, entryOffset, littleEndian);
      const type = getUint16(view, entryOffset + 2, littleEndian);
      const count = getUint32(view, entryOffset + 4, littleEndian);

      // Security: validate count to prevent huge allocations
      const typeSize = TYPE_SIZES[type] || 1;
      if (count > EXIF_MAX_ARRAY_LENGTH || count * typeSize > 1_000_000) {
        continue; // Skip entries with excessive count
      }

      const value = readTagValue(view, tiffOffset, entryOffset + 8, type, count, littleEndian);
      if (value !== null) {
        callback(tag, value);
      }
    }
  } catch {
    // Silently ignore parsing errors
  }
}

/**
 * Read a tag value based on its type
 */
function readTagValue(
  view: DataView,
  tiffOffset: number,
  valueOffset: number,
  type: number,
  count: number,
  littleEndian: boolean
): unknown {
  const typeSize = TYPE_SIZES[type] || 1;
  const totalSize = typeSize * count;

  // If value fits in 4 bytes, it's stored inline; otherwise, it's an offset
  let dataOffset: number;
  if (totalSize <= 4) {
    dataOffset = valueOffset;
  } else {
    dataOffset = tiffOffset + getUint32(view, valueOffset, littleEndian);
  }

  if (dataOffset + totalSize > view.byteLength) {
    return null;
  }

  switch (type) {
    case 1: // BYTE
    case 7: // UNDEFINED
      if (count === 1) return view.getUint8(dataOffset);
      const bytes = [];
      for (let i = 0; i < count; i++) {
        bytes.push(view.getUint8(dataOffset + i));
      }
      return bytes;

    case 2: // ASCII
      let str = '';
      // Security: limit string length
      const maxChars = Math.min(count - 1, EXIF_MAX_STRING_LENGTH);
      for (let i = 0; i < maxChars; i++) {
        const char = view.getUint8(dataOffset + i);
        if (char === 0) break;
        str += String.fromCharCode(char);
      }
      return str.trim();

    case 3: // SHORT
      if (count === 1) return getUint16(view, dataOffset, littleEndian);
      const shorts = [];
      for (let i = 0; i < count; i++) {
        shorts.push(getUint16(view, dataOffset + i * 2, littleEndian));
      }
      return shorts;

    case 4: // LONG
      if (count === 1) return getUint32(view, dataOffset, littleEndian);
      const longs = [];
      for (let i = 0; i < count; i++) {
        longs.push(getUint32(view, dataOffset + i * 4, littleEndian));
      }
      return longs;

    case 5: // RATIONAL (two LONGs: numerator, denominator)
      if (count === 1) {
        const num = getUint32(view, dataOffset, littleEndian);
        const den = getUint32(view, dataOffset + 4, littleEndian);
        return den === 0 ? 0 : num / den;
      }
      const rationals = [];
      for (let i = 0; i < count; i++) {
        const num = getUint32(view, dataOffset + i * 8, littleEndian);
        const den = getUint32(view, dataOffset + i * 8 + 4, littleEndian);
        rationals.push(den === 0 ? 0 : num / den);
      }
      return rationals;

    case 9: // SLONG
      if (count === 1) return getInt32(view, dataOffset, littleEndian);
      const slongs = [];
      for (let i = 0; i < count; i++) {
        slongs.push(getInt32(view, dataOffset + i * 4, littleEndian));
      }
      return slongs;

    case 10: // SRATIONAL
      if (count === 1) {
        const num = getInt32(view, dataOffset, littleEndian);
        const den = getInt32(view, dataOffset + 4, littleEndian);
        return den === 0 ? 0 : num / den;
      }
      const srationals = [];
      for (let i = 0; i < count; i++) {
        const num = getInt32(view, dataOffset + i * 8, littleEndian);
        const den = getInt32(view, dataOffset + i * 8 + 4, littleEndian);
        srationals.push(den === 0 ? 0 : num / den);
      }
      return srationals;

    default:
      return null;
  }
}

/**
 * Parse EXIF date string (YYYY:MM:DD HH:MM:SS)
 */
function parseExifDate(dateStr: string): Date | undefined {
  if (!dateStr || dateStr.length < 19) return undefined;

  // Format: "YYYY:MM:DD HH:MM:SS"
  const match = dateStr.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );

  // Validate the date
  if (isNaN(date.getTime())) return undefined;
  if (date.getFullYear() < 1970 || date.getFullYear() > 2100) return undefined;

  return date;
}

/**
 * Convert GPS coordinate from degrees/minutes/seconds to decimal
 */
function convertGpsCoordinate(dms: number[], negative: boolean): number {
  if (dms.length < 3) return 0;
  const decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return negative ? -decimal : decimal;
}

// Helper functions for reading with byte order
function getUint16(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint16(offset, littleEndian);
}

function getUint32(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint32(offset, littleEndian);
}

function getInt32(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getInt32(offset, littleEndian);
}

/**
 * Get the best available date from EXIF data
 * Prefers DateTimeOriginal > DateTimeDigitized > DateTime
 */
export function getBestExifDate(exif: ExifData): Date | undefined {
  return exif.dateTimeOriginal || exif.dateTimeDigitized || exif.dateTime;
}
