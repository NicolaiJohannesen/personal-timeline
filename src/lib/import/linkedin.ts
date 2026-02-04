// LinkedIn data import parser

import type {
  ImportResult,
  ImportError,
  ParsedEvent,
  LinkedInPosition,
  LinkedInEducation,
  LinkedInConnection,
} from './types';
import type { DataLayer } from '@/types';
import { isZipFile, extractCsvFiles } from './zip';
import { parseCSV } from './csv';
import { MAX_FILE_SIZE, isValidFileSize } from './validation';

interface LinkedInExport {
  Positions?: LinkedInPosition[];
  Education?: LinkedInEducation[];
  Connections?: LinkedInConnection[];
}

/**
 * Parse LinkedIn data export
 * LinkedIn exports data as separate CSV files (often in a ZIP archive)
 */
export async function parseLinkedInData(
  files: File[]
): Promise<ImportResult> {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];
  let processedFiles = 0;

  // Extract any ZIP files first
  const filesToProcess: File[] = [];
  for (const file of files) {
    // Validate file size before processing
    if (!isValidFileSize(file.size)) {
      const sizeMB = Math.round(file.size / (1024 * 1024));
      const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
      errors.push({
        file: file.name,
        message: `File too large (${sizeMB}MB). Maximum allowed size is ${maxMB}MB.`,
      });
      continue;
    }

    if (isZipFile(file)) {
      const extracted = await extractCsvFiles(file);
      filesToProcess.push(...extracted.files.map(f => f.file));
      errors.push(...extracted.errors.map(msg => ({ message: msg, file: file.name })));
    } else {
      filesToProcess.push(file);
    }
  }

  const totalFiles = filesToProcess.length;

  for (const file of filesToProcess) {
    try {
      const fileName = file.name.toLowerCase();
      const content = await file.text();

      if (fileName.includes('position') || fileName.includes('experience')) {
        const positions = parseCSV<LinkedInPosition>(content);
        for (const position of positions) {
          const parsed = parsePosition(position);
          if (parsed) events.push(parsed);
        }
        processedFiles++;
      } else if (fileName.includes('education')) {
        const education = parseCSV<LinkedInEducation>(content);
        for (const edu of education) {
          const parsed = parseEducation(edu);
          if (parsed) events.push(parsed);
        }
        processedFiles++;
      } else if (fileName.includes('connection')) {
        const connections = parseCSV<LinkedInConnection>(content);
        for (const connection of connections) {
          const parsed = parseConnection(connection);
          if (parsed) events.push(parsed);
        }
        processedFiles++;
      }
    } catch (error) {
      errors.push({
        file: file.name,
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
      totalFiles,
      processedFiles,
      totalEvents: events.length,
      eventsByLayer,
      skipped: errors.length,
    },
  };
}

/**
 * Parse LinkedIn data from pre-parsed object
 */
export function parseLinkedInObject(data: LinkedInExport): {
  events: ParsedEvent[];
  errors: ImportError[];
} {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  // Parse positions
  for (const position of data.Positions || []) {
    try {
      const parsed = parsePosition(position);
      if (parsed) events.push(parsed);
    } catch (error) {
      errors.push({
        message: 'Failed to parse position',
        data: position,
      });
    }
  }

  // Parse education
  for (const edu of data.Education || []) {
    try {
      const parsed = parseEducation(edu);
      if (parsed) events.push(parsed);
    } catch (error) {
      errors.push({
        message: 'Failed to parse education',
        data: edu,
      });
    }
  }

  // Parse connections
  for (const connection of data.Connections || []) {
    try {
      const parsed = parseConnection(connection);
      if (parsed) events.push(parsed);
    } catch (error) {
      errors.push({
        message: 'Failed to parse connection',
        data: connection,
      });
    }
  }

  return { events, errors };
}

function parsePosition(position: LinkedInPosition): ParsedEvent | null {
  if (!position['Company Name'] || !position['Started On']) return null;

  const startDate = parseLinkedInDate(position['Started On']);
  if (!startDate) return null;

  const endDate = position['Finished On']
    ? parseLinkedInDate(position['Finished On']) ?? undefined
    : undefined;

  const title = position.Title
    ? `${position.Title} at ${position['Company Name']}`
    : `Worked at ${position['Company Name']}`;

  return {
    title,
    description: position.Description,
    startDate,
    endDate,
    layer: 'work',
    eventType: 'job',
    source: 'linkedin',
    sourceId: `li_position_${startDate.getTime()}`,
    location: position.Location
      ? { name: position.Location, latitude: 0, longitude: 0 }
      : undefined,
    metadata: {
      company: position['Company Name'],
      title: position.Title,
    },
  };
}

function parseEducation(edu: LinkedInEducation): ParsedEvent | null {
  if (!edu['School Name'] || !edu['Start Date']) return null;

  const startDate = parseLinkedInDate(edu['Start Date']);
  if (!startDate) return null;

  const endDate = edu['End Date']
    ? parseLinkedInDate(edu['End Date']) ?? undefined
    : undefined;

  const title = edu['Degree Name']
    ? `${edu['Degree Name']} at ${edu['School Name']}`
    : `Studied at ${edu['School Name']}`;

  return {
    title,
    description: edu.Notes,
    startDate,
    endDate,
    layer: 'education',
    eventType: 'degree',
    source: 'linkedin',
    sourceId: `li_edu_${startDate.getTime()}`,
    metadata: {
      school: edu['School Name'],
      degree: edu['Degree Name'],
    },
  };
}

function parseConnection(connection: LinkedInConnection): ParsedEvent | null {
  if (!connection['First Name'] || !connection['Connected On']) return null;

  const connectedDate = parseLinkedInDate(connection['Connected On']);
  if (!connectedDate) return null;

  const name = [connection['First Name'], connection['Last Name']]
    .filter(Boolean)
    .join(' ');

  return {
    title: `Connected with ${name}`,
    description: connection.Company
      ? `${connection.Position || 'Works'} at ${connection.Company}`
      : undefined,
    startDate: connectedDate,
    layer: 'relationships',
    eventType: 'connection',
    source: 'linkedin',
    sourceId: `li_conn_${connectedDate.getTime()}_${name.replace(/\s/g, '_')}`,
    metadata: {
      name,
      company: connection.Company,
      position: connection.Position,
    },
  };
}

/**
 * Parse LinkedIn date format (e.g., "Jan 2020" or "2020-01-15")
 */
function parseLinkedInDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  // Try "Mon YYYY" format
  const monthYearMatch = dateStr.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (monthYearMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[monthYearMatch[1].toLowerCase()];
    const year = parseInt(monthYearMatch[2], 10);
    if (month !== undefined && !isNaN(year)) {
      return new Date(year, month, 1);
    }
  }

  // Try "YYYY" format
  const yearMatch = dateStr.match(/^(\d{4})$/);
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1], 10), 0, 1);
  }

  return null;
}

