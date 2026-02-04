// Import system - centralized exports

export type {
  ImportResult,
  ImportError,
  ImportStats,
  ParsedEvent,
  CSVMapping,
  CSVRow,
} from './types';

export { parseFacebookData } from './facebook';
export { parseLinkedInData, parseLinkedInObject } from './linkedin';
export { parseGoogleData, parseGoogleObject } from './google';
export { parseCSVData, parseCSVAuto, getCSVHeaders, previewCSV, parseCSV } from './csv';
export { parseICalData, parseICalText } from './ical';

// EXIF utilities
export { extractExif, parseExifFromBuffer, getBestExifDate } from './exif';
export type { ExifData } from './exif';

// Validation utilities
export {
  MAX_FILE_SIZE,
  MIN_YEAR,
  MAX_YEAR,
  isValidYear,
  isValidMonth,
  isValidDay,
  isValidDate,
  isValidFileSize,
  validateFileSize,
  sanitizeString,
  truncateString,
  isValidTimestamp,
  timestampToDate,
  isValidGpsCoordinate,
  hasValidGpsCoordinate,
  createValidDate,
} from './validation';

// Date parsing utilities
export {
  parseDate,
  parseISODate,
  parseSlashDate,
  parseDashDotDate,
  parseMonthYearDate,
  parseYearOnly,
  parseTimestamp,
  extractDateFromPath,
  parseExifDate,
  parseICalDate,
  getBestDate,
} from './dateParser';
export type { DateParseOptions } from './dateParser';

// Layer detection utilities
export {
  LAYER_KEYWORDS,
  detectLayer,
  detectLayerFromFields,
  matchesLayer,
  getAllMatchingLayers,
  detectPostLayer,
  detectCalendarEventLayer,
} from './layerDetection';
export type { LayerDetectionOptions, LayerDetectionResult } from './layerDetection';

// ZIP utilities
export {
  isZipFile,
  extractZip,
  extractZipByExtension,
  extractJsonFiles,
  extractCsvFiles,
} from './zip';
export type { ExtractedFile, ZipExtractionResult } from './zip';
