// Facebook data import parser

import type {
  ImportResult,
  ImportError,
  ParsedEvent,
  FacebookPost,
  FacebookFriend,
  FacebookEvent,
} from './types';
import type { DataLayer } from '@/types';
import { isZipFile, extractZip } from './zip';
import { extractExif, getBestExifDate } from './exif';
import { MAX_FILE_SIZE, isValidFileSize } from './validation';

interface FacebookExport {
  posts?: FacebookPost[];
  your_posts_1?: FacebookPost[];
  friends_v2?: FacebookFriend[];
  friends?: FacebookFriend[];
  events_invited?: FacebookEvent[];
  events_joined?: FacebookEvent[];
  your_events?: FacebookEvent[];
  event_responses?: {
    events_joined?: FacebookEvent[];
    events_invited?: FacebookEvent[];
  };
}

// Media file extensions to import
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.webm', '.webp'];

/**
 * Determine the type of Facebook data based on file path
 * Supports multiple Facebook export format variations (2020-2026+)
 */
function getFacebookFileType(path: string): 'posts' | 'friends' | 'events' | 'unknown' {
  const lowerPath = path.toLowerCase();

  // Posts - various Facebook export formats
  if (
    lowerPath.includes('posts/') ||
    lowerPath.includes('your_posts') ||
    lowerPath.includes('timeline') ||
    lowerPath.includes('wall_posts') ||
    lowerPath.includes('check_ins') ||
    lowerPath.includes('photos_and_videos')
  ) {
    return 'posts';
  }

  // Friends - various formats
  if (
    (lowerPath.includes('friends') || lowerPath.includes('connections')) &&
    !lowerPath.includes('friend_requests') &&
    !lowerPath.includes('removed_friends')
  ) {
    return 'friends';
  }

  // Events - various formats
  if (
    lowerPath.includes('events/') ||
    lowerPath.includes('event_responses') ||
    lowerPath.includes('event_invitations') ||
    lowerPath.includes('your_event')
  ) {
    return 'events';
  }

  return 'unknown';
}

/**
 * Check if a file is a media file based on extension
 */
function isMediaFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return MEDIA_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * Extract date from Facebook media file path
 * Facebook organizes photos in folders with album names that often contain dates
 * Examples:
 * - photos_and_videos/album/2023-01-15_12-30-45_UTC.jpg
 * - photos_and_videos/videos/video_2023_01_15.mp4
 * - photos_and_videos/Mobile uploads/received_123456789.jpeg
 */
function extractDateFromPath(path: string): Date | null {
  // Try various date patterns in the path
  const patterns = [
    // ISO-like: 2023-01-15 or 2023_01_15
    /(\d{4})[-_](\d{2})[-_](\d{2})/,
    // Year-month: 2023-01 or 2023_01
    /(\d{4})[-_](\d{2})(?:[-_]|$)/,
    // Just year in folder name
    /\/(\d{4})\//,
    // Facebook video timestamp: video_1234567890123.mp4 (milliseconds since epoch)
    /video[_-]?(\d{13})/i,
    // Facebook photo ID format (sometimes contains timestamp)
    /(\d{10,13})_\d+_\d+/,
  ];

  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match) {
      // Check if it's a millisecond timestamp
      if (match[1].length === 13) {
        const timestamp = parseInt(match[1], 10);
        if (timestamp > 946684800000 && timestamp < 2524608000000) { // 2000-2050
          return new Date(timestamp);
        }
      }
      // Check if it's a unix timestamp (seconds)
      if (match[1].length === 10) {
        const timestamp = parseInt(match[1], 10);
        if (timestamp > 946684800 && timestamp < 2524608000) { // 2000-2050
          return new Date(timestamp * 1000);
        }
      }
      // Try as YYYY-MM-DD
      if (match[2] && match[3]) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        if (year >= 1990 && year <= 2050 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return new Date(year, month - 1, day);
        }
      }
      // Try as YYYY-MM
      if (match[2] && !match[3]) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        if (year >= 1990 && year <= 2050 && month >= 1 && month <= 12) {
          return new Date(year, month - 1, 1);
        }
      }
      // Try as just YYYY
      if (!match[2]) {
        const year = parseInt(match[1], 10);
        if (year >= 1990 && year <= 2050) {
          return new Date(year, 0, 1);
        }
      }
    }
  }

  return null;
}

/**
 * Extract album/folder name from path for context
 */
function extractAlbumName(path: string): string | null {
  const parts = path.split('/');
  // Skip the filename and look for meaningful folder names
  for (let i = parts.length - 2; i >= 0; i--) {
    const folder = parts[i];
    // Skip generic folder names
    if (folder && !['photos_and_videos', 'photos', 'videos', 'album', 'albums'].includes(folder.toLowerCase())) {
      return folder;
    }
  }
  return null;
}

/**
 * Get media type from filename
 */
function getMediaType(filename: string): 'photo' | 'video' {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
    return 'video';
  }
  return 'photo';
}

/**
 * Parse a media file into a timeline event
 * Uses path-based date extraction first, then falls back to EXIF for images
 */
async function parseMediaFile(file: File, path: string): Promise<ParsedEvent | null> {
  const mediaType = getMediaType(file.name);

  // Try to extract date from path first (fastest)
  let date = extractDateFromPath(path);
  let dateSource = 'path';

  // For images without path-based date, try EXIF extraction
  if (!date && mediaType === 'photo') {
    try {
      const exifData = await extractExif(file);
      if (exifData) {
        const exifDate = getBestExifDate(exifData);
        if (exifDate) {
          date = exifDate;
          dateSource = 'exif';
        }
      }
    } catch {
      // EXIF extraction failed, continue without date
    }
  }

  // If still no date, skip this file
  if (!date) {
    return null;
  }

  const albumName = extractAlbumName(path);

  const title = albumName
    ? `${mediaType === 'video' ? 'Video' : 'Photo'} from "${albumName}"`
    : `${mediaType === 'video' ? 'Video' : 'Photo'}`;

  return {
    title,
    description: `Imported from Facebook: ${path}`,
    startDate: date,
    layer: 'media',
    eventType: mediaType === 'video' ? 'video' : 'photo',
    source: 'facebook',
    sourceId: `fb_media_${file.name}_${date.getTime()}`,
    metadata: {
      filename: file.name,
      path: path,
      mediaType,
      albumName: albumName || undefined,
      fileSize: file.size,
      dateSource,
    },
  };
}

/**
 * Parse Facebook data export
 * Handles: single JSON files, ZIP files (flat or nested structure), multiple ZIP files
 * Also imports photos and videos with extracted timestamps
 */
export async function parseFacebookData(
  data: FacebookExport | File[]
): Promise<ImportResult> {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];
  let totalFiles = 0;
  let processedFiles = 0;

  if (Array.isArray(data)) {
    const jsonFilesToProcess: { file: File; path: string }[] = [];
    const mediaFilesToProcess: { file: File; path: string }[] = [];

    for (const file of data) {
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
        try {
          // Extract JSON files directly from the ZIP
          const jsonExtracted = await extractZip(file, (path) => {
            const lowerPath = path.toLowerCase();
            return lowerPath.endsWith('.json') && !lowerPath.includes('__macosx');
          });
          jsonFilesToProcess.push(...jsonExtracted.files.map(f => ({ file: f.file, path: f.path })));

          // Extract media files from the ZIP
          const mediaExtracted = await extractZip(file, (path) => {
            const lowerPath = path.toLowerCase();
            return isMediaFile(lowerPath) && !lowerPath.includes('__macosx');
          });
          mediaFilesToProcess.push(...mediaExtracted.files.map(f => ({ file: f.file, path: f.path })));

          // Check for nested ZIP files
          const nestedZipResult = await extractZip(file, (path) => {
            const lowerPath = path.toLowerCase();
            return lowerPath.endsWith('.zip') && !lowerPath.includes('__macosx');
          });

          // Process any nested ZIPs that have actual content (size > 0)
          for (const nestedZip of nestedZipResult.files) {
            if (nestedZip.file.size > 0) {
              try {
                // Extract JSON from nested ZIP
                const nestedJson = await extractZip(nestedZip.file, (path) => {
                  const lowerPath = path.toLowerCase();
                  return lowerPath.endsWith('.json') && !lowerPath.includes('__macosx');
                });
                jsonFilesToProcess.push(...nestedJson.files.map(f => ({ file: f.file, path: f.path })));

                // Extract media from nested ZIP
                const nestedMedia = await extractZip(nestedZip.file, (path) => {
                  const lowerPath = path.toLowerCase();
                  return isMediaFile(lowerPath) && !lowerPath.includes('__macosx');
                });
                mediaFilesToProcess.push(...nestedMedia.files.map(f => ({ file: f.file, path: f.path })));

                errors.push(...nestedJson.errors.map(msg => ({ message: msg, file: nestedZip.name })));
              } catch {
                errors.push({ message: 'Failed to extract nested ZIP', file: nestedZip.name });
              }
            }
          }

          if (jsonExtracted.errors.length > 0) {
            errors.push(...jsonExtracted.errors.map(msg => ({ message: msg, file: file.name })));
          }
        } catch {
          errors.push({ message: 'Failed to extract ZIP', file: file.name });
        }
      } else if (file.name.toLowerCase().endsWith('.json')) {
        jsonFilesToProcess.push({ file, path: file.name });
      } else if (isMediaFile(file.name)) {
        mediaFilesToProcess.push({ file, path: file.name });
      }
    }

    totalFiles = jsonFilesToProcess.length + mediaFilesToProcess.length;

    // Process JSON files
    for (const { file, path } of jsonFilesToProcess) {
      try {
        const text = await file.text();

        if (!text || text.trim().length === 0) {
          continue;
        }

        let content: unknown;
        try {
          content = JSON.parse(text);
        } catch {
          errors.push({
            file: path,
            message: 'Invalid JSON format',
          });
          continue;
        }

        const fileType = getFacebookFileType(path);
        const parsed = parseFacebookFileContent(content, fileType, path);

        events.push(...parsed.events);
        errors.push(...parsed.errors);
        processedFiles++;
      } catch {
        errors.push({
          file: file.name,
          message: 'Failed to parse file',
        });
      }
    }

    // Process media files
    let mediaWithDates = 0;
    let mediaWithoutDates = 0;
    for (const { file, path } of mediaFilesToProcess) {
      try {
        const parsed = await parseMediaFile(file, path);
        if (parsed) {
          events.push(parsed);
          mediaWithDates++;
          processedFiles++;
        } else {
          mediaWithoutDates++;
        }
      } catch {
        errors.push({
          file: file.name,
          message: 'Failed to parse media file',
        });
      }
    }

    // Report media files without dates
    if (mediaWithoutDates > 0) {
      errors.push({
        message: `${mediaWithoutDates} media files skipped (no date found in filename/path or EXIF)`,
      });
    }
  } else {
    // Handle direct object input (for backwards compatibility with tests)
    totalFiles = 1;
    const parsed = parseFacebookObject(data);
    events.push(...parsed.events);
    errors.push(...parsed.errors);
    processedFiles = 1;
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
 * Parse content based on inferred file type
 */
function parseFacebookFileContent(
  content: unknown,
  fileType: 'posts' | 'friends' | 'events' | 'unknown',
  filePath: string
): { events: ParsedEvent[]; errors: ImportError[] } {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  // Handle raw arrays (common in Facebook exports)
  if (Array.isArray(content)) {
    switch (fileType) {
      case 'posts':
        for (const post of content) {
          try {
            const parsed = parsePost(post as FacebookPost);
            if (parsed) events.push(parsed);
          } catch {
            errors.push({ message: 'Failed to parse post', file: filePath });
          }
        }
        break;
      case 'friends':
        for (const friend of content) {
          try {
            const parsed = parseFriend(friend as FacebookFriend);
            if (parsed) events.push(parsed);
          } catch {
            errors.push({ message: 'Failed to parse friend', file: filePath });
          }
        }
        break;
      case 'events':
        for (const event of content) {
          try {
            const parsed = parseFacebookEvent(event as FacebookEvent);
            if (parsed) events.push(parsed);
          } catch {
            errors.push({ message: 'Failed to parse event', file: filePath });
          }
        }
        break;
      default:
        // Try to auto-detect based on content structure
        for (const item of content) {
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            // Looks like a post (has timestamp and title/data)
            if ('timestamp' in obj && ('title' in obj || 'data' in obj)) {
              try {
                const parsed = parsePost(obj as FacebookPost);
                if (parsed) events.push(parsed);
              } catch {
                // Skip
              }
            }
            // Looks like a friend (has name and timestamp)
            else if ('name' in obj && 'timestamp' in obj && !('start_timestamp' in obj)) {
              try {
                const parsed = parseFriend(obj as FacebookFriend);
                if (parsed) events.push(parsed);
              } catch {
                // Skip
              }
            }
            // Looks like an event (has name and start_timestamp)
            else if ('name' in obj && 'start_timestamp' in obj) {
              try {
                const parsed = parseFacebookEvent(obj as FacebookEvent);
                if (parsed) events.push(parsed);
              } catch {
                // Skip
              }
            }
          }
        }
    }
  } else if (content && typeof content === 'object') {
    // Handle object with known keys
    const parsed = parseFacebookObject(content as FacebookExport);
    events.push(...parsed.events);
    errors.push(...parsed.errors);
  }

  return { events, errors };
}

/**
 * Parse Facebook object with known key structure (backwards compatible)
 */
function parseFacebookObject(data: FacebookExport): {
  events: ParsedEvent[];
  errors: ImportError[];
} {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];

  // Parse posts from various possible keys
  const posts = data.posts || data.your_posts_1 || [];
  for (const post of posts) {
    try {
      const parsed = parsePost(post);
      if (parsed) events.push(parsed);
    } catch {
      errors.push({
        message: 'Failed to parse post',
        data: post,
      });
    }
  }

  // Parse friends from various possible keys
  const friends = data.friends_v2 || data.friends || [];
  for (const friend of friends) {
    try {
      const parsed = parseFriend(friend);
      if (parsed) events.push(parsed);
    } catch {
      errors.push({
        message: 'Failed to parse friend',
        data: friend,
      });
    }
  }

  // Parse events from various possible keys
  const fbEvents = [
    ...(data.events_invited || []),
    ...(data.events_joined || []),
    ...(data.your_events || []),
    ...(data.event_responses?.events_joined || []),
    ...(data.event_responses?.events_invited || []),
  ];
  for (const event of fbEvents) {
    try {
      const parsed = parseFacebookEvent(event);
      if (parsed) events.push(parsed);
    } catch {
      errors.push({
        message: 'Failed to parse event',
        data: event,
      });
    }
  }

  return { events, errors };
}

function parsePost(post: FacebookPost): ParsedEvent | null {
  const timestamp = post.timestamp || post.data?.[0]?.update_timestamp;
  if (!timestamp) return null;

  const postText = post.title || post.data?.[0]?.post || '';
  if (!postText.trim()) return null;

  // Check for location data (indicates travel)
  const place = post.attachments?.[0]?.data?.[0]?.place;
  const hasMedia = post.attachments?.[0]?.data?.[0]?.media;

  // Determine layer based on content
  let layer: DataLayer = 'media';
  if (place) {
    layer = 'travel';
  }

  return {
    title: truncateText(postText, 100),
    description: postText.length > 100 ? postText : undefined,
    startDate: new Date(timestamp * 1000),
    layer,
    eventType: hasMedia ? 'photo_post' : 'post',
    source: 'facebook',
    sourceId: `fb_post_${timestamp}`,
    location: place
      ? {
          name: place.name,
          latitude: place.coordinate?.latitude || 0,
          longitude: place.coordinate?.longitude || 0,
        }
      : undefined,
    metadata: {
      hasMedia: !!hasMedia,
    },
  };
}

function parseFriend(friend: FacebookFriend): ParsedEvent | null {
  if (!friend.name || !friend.timestamp) return null;

  return {
    title: `Connected with ${friend.name}`,
    startDate: new Date(friend.timestamp * 1000),
    layer: 'relationships',
    eventType: 'connection',
    source: 'facebook',
    sourceId: `fb_friend_${friend.timestamp}`,
    metadata: {
      friendName: friend.name,
    },
  };
}

function parseFacebookEvent(event: FacebookEvent): ParsedEvent | null {
  if (!event.name || !event.start_timestamp) return null;

  return {
    title: event.name,
    startDate: new Date(event.start_timestamp * 1000),
    endDate: event.end_timestamp
      ? new Date(event.end_timestamp * 1000)
      : undefined,
    layer: event.place ? 'travel' : 'media',
    eventType: 'event',
    source: 'facebook',
    sourceId: `fb_event_${event.start_timestamp}`,
    location: event.place
      ? {
          name: event.place.name,
          latitude: event.place.coordinate?.latitude || 0,
          longitude: event.place.coordinate?.longitude || 0,
        }
      : undefined,
  };
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
