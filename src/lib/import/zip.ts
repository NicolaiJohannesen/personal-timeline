// ZIP file extraction utility for data imports

import JSZip from 'jszip';

export interface ExtractedFile {
  name: string;
  path: string;
  file: File;
}

export interface ZipExtractionResult {
  files: ExtractedFile[];
  errors: string[];
}

/**
 * Check if a file is a ZIP archive
 */
export function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.zip');
}

/**
 * Read file as ArrayBuffer (works in both browser and Node.js)
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  // Try arrayBuffer() method first (browser)
  if (typeof file.arrayBuffer === 'function') {
    try {
      return await file.arrayBuffer();
    } catch {
      // Fall through to alternative method
    }
  }

  // Fallback: use FileReader-like approach or read from Blob
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract files from a ZIP archive
 * @param zipFile The ZIP file to extract
 * @param filter Optional filter function to include only certain files
 * @returns Extracted files and any errors encountered
 */
export async function extractZip(
  zipFile: File,
  filter?: (path: string) => boolean
): Promise<ZipExtractionResult> {
  const files: ExtractedFile[] = [];
  const errors: string[] = [];

  try {
    const arrayBuffer = await readFileAsArrayBuffer(zipFile);
    const zip = await JSZip.loadAsync(arrayBuffer);
    const entries = Object.entries(zip.files);

    for (const [path, zipEntry] of entries) {
      // Skip directories - check both the dir flag AND if path ends with /
      if (zipEntry.dir || path.endsWith('/')) {
        continue;
      }

      // Skip hidden files and system files
      const fileName = path.split('/').pop() || '';
      if (fileName.startsWith('.') || fileName === '') {
        continue;
      }

      // Apply filter if provided
      if (filter && !filter(path)) {
        continue;
      }

      try {
        // Use uint8array for reliable extraction
        const uint8Array = await zipEntry.async('uint8array');

        // Skip entries with no actual content (likely folder entries misreported as files)
        if (uint8Array.length === 0) {
          continue;
        }

        const mimeType = getMimeType(fileName);
        // Create a new ArrayBuffer copy to ensure proper type for Blob
        const arrayBuffer = new ArrayBuffer(uint8Array.byteLength);
        new Uint8Array(arrayBuffer).set(uint8Array);
        const blob = new Blob([arrayBuffer], { type: mimeType });
        const file = new File([blob], fileName, { type: mimeType });

        files.push({
          name: fileName,
          path: path,
          file: file,
        });
      } catch (err) {
        errors.push(`Failed to extract ${path}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to read ZIP file: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return { files, errors };
}

/**
 * Extract files from a ZIP archive, filtering by extension
 */
export async function extractZipByExtension(
  zipFile: File,
  extensions: string[]
): Promise<ZipExtractionResult> {
  const lowerExtensions = extensions.map(ext => ext.toLowerCase());
  return extractZip(zipFile, (path) => {
    const ext = getExtension(path);
    return lowerExtensions.includes(ext);
  });
}

/**
 * Extract only JSON files from a ZIP archive
 */
export async function extractJsonFiles(zipFile: File): Promise<ZipExtractionResult> {
  return extractZipByExtension(zipFile, ['.json']);
}

/**
 * Extract only CSV files from a ZIP archive
 */
export async function extractCsvFiles(zipFile: File): Promise<ZipExtractionResult> {
  return extractZipByExtension(zipFile, ['.csv']);
}

/**
 * Get file extension including the dot
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(filename: string): string {
  const ext = getExtension(filename);
  const mimeTypes: Record<string, string> = {
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.xml': 'application/xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.zip': 'application/zip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
