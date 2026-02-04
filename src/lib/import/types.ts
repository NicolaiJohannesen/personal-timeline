// Import system types

import type { TimelineEvent, DataLayer, EventSource } from '@/types';

export interface ImportResult {
  events: Omit<TimelineEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[];
  errors: ImportError[];
  stats: ImportStats;
}

export interface ImportError {
  file?: string;
  message: string;
  data?: unknown;
}

export interface ImportStats {
  totalFiles: number;
  processedFiles: number;
  totalEvents: number;
  eventsByLayer: Partial<Record<DataLayer, number>>;
  skipped: number;
}

export interface ParsedEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  layer: DataLayer;
  eventType: string;
  source: EventSource;
  sourceId?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
}

// Facebook data structures
export interface FacebookPost {
  timestamp?: number;
  data?: Array<{
    post?: string;
    update_timestamp?: number;
  }>;
  title?: string;
  attachments?: Array<{
    data?: Array<{
      media?: {
        uri?: string;
        title?: string;
      };
      place?: {
        name?: string;
        coordinate?: {
          latitude?: number;
          longitude?: number;
        };
      };
    }>;
  }>;
}

export interface FacebookFriend {
  name?: string;
  timestamp?: number;
}

export interface FacebookEvent {
  name?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  place?: {
    name?: string;
    coordinate?: {
      latitude?: number;
      longitude?: number;
    };
  };
}

// LinkedIn data structures
export interface LinkedInPosition {
  'Company Name'?: string;
  Title?: string;
  'Started On'?: string;
  'Finished On'?: string;
  Description?: string;
  Location?: string;
}

export interface LinkedInEducation {
  'School Name'?: string;
  'Degree Name'?: string;
  'Start Date'?: string;
  'End Date'?: string;
  Notes?: string;
}

export interface LinkedInConnection {
  'First Name'?: string;
  'Last Name'?: string;
  'Connected On'?: string;
  Company?: string;
  Position?: string;
}

// Google Takeout structures
export interface GoogleLocation {
  timestampMs?: string;
  latitudeE7?: number;
  longitudeE7?: number;
  accuracy?: number;
  activity?: Array<{
    type?: string;
    confidence?: number;
  }>;
}

export interface GoogleCalendarEvent {
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

export interface GoogleKeepListItem {
  text?: string;
  isChecked?: boolean;
}

export interface GoogleKeepNote {
  title?: string;
  textContent?: string;
  listContent?: GoogleKeepListItem[];
  createdTimestampUsec?: number;
  userEditedTimestampUsec?: number;
  labels?: Array<{ name: string }>;
  isPinned?: boolean;
  isArchived?: boolean;
  isTrashed?: boolean;
}

// CSV structures
export interface CSVRow {
  [key: string]: string;
}

export interface CSVMapping {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  layer?: string;
  eventType?: string;
}
