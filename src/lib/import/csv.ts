// Custom CSV data import parser

import type {
  ImportResult,
  ImportError,
  ParsedEvent,
  CSVRow,
  CSVMapping,
} from './types';
import type { DataLayer } from '@/types';
import { isZipFile, extractCsvFiles } from './zip';
import { MAX_FILE_SIZE, isValidFileSize } from './validation';

const VALID_LAYERS: DataLayer[] = [
  'economics',
  'education',
  'work',
  'health',
  'relationships',
  'travel',
  'media',
];

// CSV parsing limits for security
const CSV_MAX_LINE_LENGTH = 1_000_000; // 1MB per line
const CSV_MAX_COLUMNS = 1000;
const CSV_MAX_ROWS = 100_000;
const CSV_MAX_CELL_LENGTH = 100_000; // 100KB per cell

/**
 * Parse custom CSV file with column mapping
 * Supports both single CSV files and ZIP archives containing CSVs
 */
export async function parseCSVData(
  file: File,
  mapping: CSVMapping
): Promise<ImportResult> {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  // Validate file size before processing
  if (!isValidFileSize(file.size)) {
    const sizeMB = Math.round(file.size / (1024 * 1024));
    const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    return {
      events: [],
      errors: [{ file: file.name, message: `File too large (${sizeMB}MB). Maximum allowed size is ${maxMB}MB.` }],
      stats: { totalFiles: 1, processedFiles: 0, totalEvents: 0, eventsByLayer: {}, skipped: 1 },
    };
  }

  // Extract files from ZIP if needed
  let filesToProcess: File[] = [];
  if (isZipFile(file)) {
    const extracted = await extractCsvFiles(file);
    filesToProcess = extracted.files.map(f => f.file);
    errors.push(...extracted.errors.map(msg => ({ message: msg, file: file.name })));
  } else {
    filesToProcess = [file];
  }

  for (const csvFile of filesToProcess) {
    try {
      const content = await csvFile.text();
      const rows = parseCSV(content);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const parsed = parseCSVRow(row, mapping, i);
          if (parsed) events.push(parsed);
        } catch (error) {
          errors.push({
            file: csvFile.name,
            message: `Row ${i + 2}: ${error instanceof Error ? error.message : 'Parse error'}`,
            data: row,
          });
        }
      }
    } catch (error) {
      errors.push({
        file: csvFile.name,
        message: error instanceof Error ? error.message : 'Failed to parse file',
      });
    }
  }

  // Calculate stats
  const eventsByLayer: Partial<Record<DataLayer, number>> = {};
  for (const event of events) {
    eventsByLayer[event.layer] = (eventsByLayer[event.layer] || 0) + 1;
  }

  return {
    events,
    errors,
    stats: {
      totalFiles: filesToProcess.length,
      processedFiles: filesToProcess.length - errors.filter(e => e.file).length,
      totalEvents: events.length,
      eventsByLayer,
      skipped: errors.length,
    },
  };
}

/**
 * Parse CSV with auto-detected mapping
 * Supports both single CSV files and ZIP archives containing CSVs
 */
export async function parseCSVAuto(file: File): Promise<ImportResult> {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  // Validate file size before processing
  if (!isValidFileSize(file.size)) {
    const sizeMB = Math.round(file.size / (1024 * 1024));
    const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    return {
      events: [],
      errors: [{ file: file.name, message: `File too large (${sizeMB}MB). Maximum allowed size is ${maxMB}MB.` }],
      stats: { totalFiles: 1, processedFiles: 0, totalEvents: 0, eventsByLayer: {}, skipped: 1 },
    };
  }

  // Extract files from ZIP if needed
  let filesToProcess: File[] = [];
  if (isZipFile(file)) {
    const extracted = await extractCsvFiles(file);
    filesToProcess = extracted.files.map(f => f.file);
    errors.push(...extracted.errors.map(msg => ({ message: msg, file: file.name })));
  } else {
    filesToProcess = [file];
  }

  if (filesToProcess.length === 0) {
    return {
      events: [],
      errors: [{ file: file.name, message: 'No CSV files found' }],
      stats: {
        totalFiles: 0,
        processedFiles: 0,
        totalEvents: 0,
        eventsByLayer: {},
        skipped: 1,
      },
    };
  }

  for (const csvFile of filesToProcess) {
    try {
      const content = await csvFile.text();
      const rows = parseCSV(content);

      if (rows.length === 0) {
        errors.push({ file: csvFile.name, message: 'No data rows found' });
        continue;
      }

      // Auto-detect mapping from headers
      const mapping = detectMapping(Object.keys(rows[0]));
      if (!mapping) {
        errors.push({ file: csvFile.name, message: 'Could not auto-detect column mapping' });
        continue;
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const parsed = parseCSVRow(row, mapping, i);
          if (parsed) events.push(parsed);
        } catch (error) {
          errors.push({
            file: csvFile.name,
            message: `Row ${i + 2}: ${error instanceof Error ? error.message : 'Parse error'}`,
            data: row,
          });
        }
      }
    } catch (error) {
      errors.push({
        file: csvFile.name,
        message: error instanceof Error ? error.message : 'Failed to parse file',
      });
    }
  }

  // Calculate stats
  const eventsByLayer: Partial<Record<DataLayer, number>> = {};
  for (const event of events) {
    eventsByLayer[event.layer] = (eventsByLayer[event.layer] || 0) + 1;
  }

  return {
    events,
    errors,
    stats: {
      totalFiles: filesToProcess.length,
      processedFiles: filesToProcess.length - errors.filter(e => e.message === 'No data rows found' || e.message === 'Could not auto-detect column mapping').length,
      totalEvents: events.length,
      eventsByLayer,
      skipped: errors.length,
    },
  };
}

function parseCSVRow(
  row: CSVRow,
  mapping: CSVMapping,
  index: number
): ParsedEvent | null {
  const title = row[mapping.title]?.trim();
  if (!title) return null;

  const startDateStr = row[mapping.startDate]?.trim();
  if (!startDateStr) return null;

  const startDate = parseDate(startDateStr);
  if (!startDate) {
    throw new Error(`Invalid start date: ${startDateStr}`);
  }

  const endDateStr = mapping.endDate ? row[mapping.endDate]?.trim() : undefined;
  const endDate = endDateStr ? parseDate(endDateStr) ?? undefined : undefined;

  const layerStr = mapping.layer ? row[mapping.layer]?.trim().toLowerCase() : 'media';
  const layer = VALID_LAYERS.includes(layerStr as DataLayer)
    ? (layerStr as DataLayer)
    : 'media';

  const eventType = mapping.eventType
    ? row[mapping.eventType]?.trim() || 'custom'
    : 'custom';

  return {
    title,
    description: mapping.description ? row[mapping.description]?.trim() : undefined,
    startDate,
    endDate,
    layer,
    eventType,
    source: 'other',
    sourceId: `csv_${index}_${startDate.getTime()}`,
    metadata: {
      originalRow: row,
    },
  };
}

/**
 * Auto-detect column mapping from headers
 */
function detectMapping(headers: string[]): CSVMapping | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // Find title column
  const titleIdx = lowerHeaders.findIndex((h) =>
    ['title', 'name', 'event', 'subject', 'summary'].includes(h)
  );
  if (titleIdx === -1) return null;

  // Find date column
  const dateIdx = lowerHeaders.findIndex((h) =>
    ['date', 'start', 'start_date', 'startdate', 'started', 'when', 'timestamp'].includes(h)
  );
  if (dateIdx === -1) return null;

  // Find optional columns
  const descIdx = lowerHeaders.findIndex((h) =>
    ['description', 'desc', 'details', 'notes', 'content', 'body'].includes(h)
  );
  const endIdx = lowerHeaders.findIndex((h) =>
    ['end', 'end_date', 'enddate', 'ended', 'finish', 'finished'].includes(h)
  );
  const layerIdx = lowerHeaders.findIndex((h) =>
    ['layer', 'type', 'category', 'kind'].includes(h)
  );
  const eventTypeIdx = lowerHeaders.findIndex((h) =>
    ['event_type', 'eventtype', 'subtype'].includes(h)
  );

  return {
    title: headers[titleIdx],
    startDate: headers[dateIdx],
    description: descIdx >= 0 ? headers[descIdx] : undefined,
    endDate: endIdx >= 0 ? headers[endIdx] : undefined,
    layer: layerIdx >= 0 ? headers[layerIdx] : undefined,
    eventType: eventTypeIdx >= 0 ? headers[eventTypeIdx] : undefined,
  };
}

/**
 * Parse various date formats
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  // Try MM/DD/YYYY format
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD/MM/YYYY format
  const euMatch = dateStr.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD format
  const isoShortMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoShortMatch) {
    const [, year, month, day] = isoShortMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * CSV parsing error for better error handling
 */
export class CSVParseError extends Error {
  constructor(
    message: string,
    public readonly lineNumber?: number,
    public readonly columnNumber?: number
  ) {
    super(message);
    this.name = 'CSVParseError';
  }
}

/**
 * Parse CSV content into rows with security limits
 * @template T - Type of the parsed rows (defaults to CSVRow)
 * @throws CSVParseError for parsing issues
 */
export function parseCSV<T = CSVRow>(content: string): T[] {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Check row limit
  if (lines.length > CSV_MAX_ROWS + 1) {
    throw new CSVParseError(
      `CSV exceeds maximum row limit of ${CSV_MAX_ROWS.toLocaleString()} rows`
    );
  }

  const headers = parseCSVLine(lines[0], 1);

  // Check column limit
  if (headers.length > CSV_MAX_COLUMNS) {
    throw new CSVParseError(
      `CSV exceeds maximum column limit of ${CSV_MAX_COLUMNS} columns`,
      1
    );
  }

  const results: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], i + 1);
    const row: CSVRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    results.push(row as T);
  }

  return results;
}

/**
 * Parse a single CSV line with security limits
 * @param line - The line to parse
 * @param lineNumber - Line number for error reporting (1-indexed)
 * @throws CSVParseError for parsing issues
 */
function parseCSVLine(line: string, lineNumber?: number): string[] {
  // Check line length limit
  if (line.length > CSV_MAX_LINE_LENGTH) {
    throw new CSVParseError(
      `Line exceeds maximum length of ${CSV_MAX_LINE_LENGTH.toLocaleString()} characters`,
      lineNumber
    );
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let columnNumber = 1;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Check cell length limit
      if (current.length > CSV_MAX_CELL_LENGTH) {
        throw new CSVParseError(
          `Cell value exceeds maximum length of ${CSV_MAX_CELL_LENGTH.toLocaleString()} characters`,
          lineNumber,
          columnNumber
        );
      }
      result.push(current.trim());
      current = '';
      columnNumber++;
    } else {
      current += char;
    }
  }

  // Check if quotes are properly closed
  if (inQuotes) {
    throw new CSVParseError(
      'Unclosed quote in CSV line',
      lineNumber
    );
  }

  // Check final cell length limit
  if (current.length > CSV_MAX_CELL_LENGTH) {
    throw new CSVParseError(
      `Cell value exceeds maximum length of ${CSV_MAX_CELL_LENGTH.toLocaleString()} characters`,
      lineNumber,
      columnNumber
    );
  }

  result.push(current.trim());
  return result;
}

/**
 * Get headers from a CSV file
 */
export async function getCSVHeaders(file: File): Promise<string[]> {
  const content = await file.text();
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];
  return parseCSVLine(lines[0]);
}

/**
 * Preview CSV data (first N rows)
 */
export async function previewCSV(
  file: File,
  maxRows = 5
): Promise<{ headers: string[]; rows: CSVRow[] }> {
  const content = await file.text();
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    rows.push(row);
  }

  return { headers, rows };
}

