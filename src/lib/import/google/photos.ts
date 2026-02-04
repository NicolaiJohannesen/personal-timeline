/**
 * Google Photos data import parser
 * Handles Google Takeout exports with photos and JSON sidecar files
 */

import type { ImportResult, ImportError, ParsedEvent } from '../types';
import type { DataLayer } from '@/types';
import { isZipFile, extractZip } from '../zip';
import { extractExif, getBestExifDate } from '../exif';

// Google Photos JSON sidecar structure
interface GooglePhotoMetadata {
  title?: string;
  description?: string;
  imageViews?: string;
  creationTime?: {
    timestamp?: string;
    formatted?: string;
  };
  photoTakenTime?: {
    timestamp?: string;
    formatted?: string;
  };
  geoData?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  geoDataExif?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  googlePhotosOrigin?: {
    mobileUpload?: {
      deviceFolder?: {
        localFolderName?: string;
      };
    };
  };
  people?: Array<{ name?: string }>;
}

// Media file extensions
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.mp4', '.mov', '.webm', '.avi', '.mkv'];

/**
 * Check if a file is a media file
 */
function isMediaFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * Check if a file is a video
 */
function isVideoFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ['.mp4', '.mov', '.webm', '.avi', '.mkv'].some(ext => lower.endsWith(ext));
}

/**
 * Check if a file is a JSON sidecar for a media file
 */
function isJsonSidecar(filename: string): boolean {
  const lower = filename.toLowerCase();
  // Google Photos uses ".json" suffix after the media extension
  // e.g., "IMG_1234.jpg.json"
  for (const ext of MEDIA_EXTENSIONS) {
    if (lower.endsWith(ext + '.json')) {
      return true;
    }
  }
  return false;
}

/**
 * Get the media filename from a JSON sidecar filename
 */
function getMediaFilename(sidecarPath: string): string {
  // Remove .json suffix to get media filename
  return sidecarPath.replace(/\.json$/i, '');
}

/**
 * Extract album name from path
 */
function extractAlbumName(path: string): string | null {
  const parts = path.split('/');
  // Look for meaningful folder names
  for (let i = parts.length - 2; i >= 0; i--) {
    const folder = parts[i];
    if (folder && !['google photos', 'takeout', 'photos'].includes(folder.toLowerCase())) {
      // Skip "Photos from YYYY" default folders
      if (!/^photos from \d{4}$/i.test(folder)) {
        return folder;
      }
    }
  }
  return null;
}

/**
 * Parse Google Photos data export
 */
export async function parseGooglePhotosData(files: File[]): Promise<ImportResult> {
  const events: ParsedEvent[] = [];
  const errors: ImportError[] = [];
  let totalFiles = 0;
  let processedFiles = 0;

  // Collect files to process
  const mediaFiles: Map<string, { file: File; path: string }> = new Map();
  const sidecarFiles: Map<string, { file: File; path: string }> = new Map();

  for (const file of files) {
    if (isZipFile(file)) {
      try {
        // Extract media files
        const mediaExtracted = await extractZip(file, (path) => {
          const lower = path.toLowerCase();
          return isMediaFile(lower) && !lower.includes('__macosx');
        });
        for (const extracted of mediaExtracted.files) {
          mediaFiles.set(extracted.path.toLowerCase(), { file: extracted.file, path: extracted.path });
        }

        // Extract JSON sidecar files
        const jsonExtracted = await extractZip(file, (path) => {
          const lower = path.toLowerCase();
          return isJsonSidecar(lower) && !lower.includes('__macosx');
        });
        for (const extracted of jsonExtracted.files) {
          sidecarFiles.set(extracted.path.toLowerCase(), { file: extracted.file, path: extracted.path });
        }

        if (mediaExtracted.errors.length > 0) {
          errors.push(...mediaExtracted.errors.map(msg => ({ message: msg, file: file.name })));
        }
      } catch {
        errors.push({ message: 'Failed to extract ZIP', file: file.name });
      }
    } else if (isMediaFile(file.name)) {
      mediaFiles.set(file.name.toLowerCase(), { file, path: file.name });
    } else if (isJsonSidecar(file.name)) {
      sidecarFiles.set(file.name.toLowerCase(), { file, path: file.name });
    }
  }

  totalFiles = mediaFiles.size;

  // Process each media file
  for (const [mediaPath, { file: mediaFile, path }] of mediaFiles) {
    try {
      // Look for matching JSON sidecar
      const sidecarPath = mediaPath + '.json';
      const sidecar = sidecarFiles.get(sidecarPath);

      let metadata: GooglePhotoMetadata | null = null;
      if (sidecar) {
        try {
          const text = await sidecar.file.text();
          metadata = JSON.parse(text) as GooglePhotoMetadata;
        } catch {
          // Sidecar parsing failed, continue without it
        }
      }

      // Extract EXIF from media file (only for images, not videos)
      let exifDate: Date | undefined;
      let exifGps: { latitude: number; longitude: number } | undefined;

      if (!isVideoFile(mediaFile.name)) {
        try {
          const exif = await extractExif(mediaFile);
          if (exif) {
            exifDate = getBestExifDate(exif);
            if (exif.gpsLatitude !== undefined && exif.gpsLongitude !== undefined) {
              exifGps = { latitude: exif.gpsLatitude, longitude: exif.gpsLongitude };
            }
          }
        } catch {
          // EXIF extraction failed, continue without it
        }
      }

      // Determine the best date (prefer sidecar > EXIF > file path patterns)
      let eventDate: Date | null = null;

      // Try sidecar photoTakenTime first (most accurate)
      if (metadata?.photoTakenTime?.timestamp) {
        const timestamp = parseInt(metadata.photoTakenTime.timestamp, 10);
        if (!isNaN(timestamp) && timestamp > 0) {
          eventDate = new Date(timestamp * 1000);
        }
      }

      // Fall back to sidecar creationTime
      if (!eventDate && metadata?.creationTime?.timestamp) {
        const timestamp = parseInt(metadata.creationTime.timestamp, 10);
        if (!isNaN(timestamp) && timestamp > 0) {
          eventDate = new Date(timestamp * 1000);
        }
      }

      // Fall back to EXIF date
      if (!eventDate && exifDate) {
        eventDate = exifDate;
      }

      // Fall back to extracting date from path
      if (!eventDate) {
        eventDate = extractDateFromPath(path);
      }

      // Skip if no date found
      if (!eventDate) {
        continue;
      }

      // Determine location (prefer sidecar > EXIF)
      let location: { latitude: number; longitude: number; name?: string } | undefined;

      if (metadata?.geoData?.latitude && metadata?.geoData?.longitude) {
        location = {
          latitude: metadata.geoData.latitude,
          longitude: metadata.geoData.longitude,
        };
      } else if (metadata?.geoDataExif?.latitude && metadata?.geoDataExif?.longitude) {
        location = {
          latitude: metadata.geoDataExif.latitude,
          longitude: metadata.geoDataExif.longitude,
        };
      } else if (exifGps) {
        location = exifGps;
      }

      // Build event
      const albumName = extractAlbumName(path);
      const isVideo = isVideoFile(mediaFile.name);
      const title = metadata?.title || mediaFile.name;
      const description = metadata?.description || undefined;

      // Determine layer based on location
      const layer: DataLayer = location ? 'travel' : 'media';

      const event: ParsedEvent = {
        title: albumName ? `${isVideo ? 'Video' : 'Photo'} from "${albumName}"` : title,
        description: description || (albumName ? `${title}` : undefined),
        startDate: eventDate,
        layer,
        eventType: isVideo ? 'video' : 'photo',
        source: 'google',
        sourceId: `gp_${mediaFile.name}_${eventDate.getTime()}`,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          name: location.name,
        } : undefined,
        metadata: {
          filename: mediaFile.name,
          path: path,
          albumName: albumName || undefined,
          fileSize: mediaFile.size,
          hasSidecar: !!metadata,
          people: metadata?.people?.map(p => p.name).filter(Boolean) || undefined,
        },
      };

      events.push(event);
      processedFiles++;
    } catch {
      errors.push({ message: 'Failed to parse media file', file: path });
    }
  }

  // Report stats
  const mediaWithoutDates = totalFiles - processedFiles;
  if (mediaWithoutDates > 0) {
    errors.push({
      message: `${mediaWithoutDates} media files skipped (no date found)`,
    });
  }

  // Calculate stats by layer
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
 * Extract date from file path patterns
 */
function extractDateFromPath(path: string): Date | null {
  const patterns = [
    // Google Photos folder: "Photos from 2023"
    /photos from (\d{4})/i,
    // ISO date: 2023-01-15 or 2023_01_15
    /(\d{4})[-_](\d{2})[-_](\d{2})/,
    // Timestamp in filename
    /IMG_(\d{4})(\d{2})(\d{2})/i,
    /VID_(\d{4})(\d{2})(\d{2})/i,
    /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match) {
      // "Photos from YYYY" pattern
      if (match.length === 2) {
        const year = parseInt(match[1], 10);
        if (year >= 1990 && year <= 2100) {
          return new Date(year, 0, 1);
        }
      }
      // YYYY-MM-DD or YYYYMMDD patterns
      if (match.length >= 4) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const hour = match[4] ? parseInt(match[4], 10) : 0;
          const minute = match[5] ? parseInt(match[5], 10) : 0;
          const second = match[6] ? parseInt(match[6], 10) : 0;
          return new Date(year, month - 1, day, hour, minute, second);
        }
      }
    }
  }

  return null;
}
