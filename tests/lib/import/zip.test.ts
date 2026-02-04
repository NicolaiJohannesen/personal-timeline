import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  isZipFile,
  extractZip,
  extractZipByExtension,
  extractJsonFiles,
  extractCsvFiles,
} from '@/lib/import/zip';

// Helper to create a mock ZIP file with proper arrayBuffer support
async function createMockZip(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const file = new File([arrayBuffer], 'test.zip', { type: 'application/zip' });
  // Override arrayBuffer to work in Node.js environment
  (file as any).arrayBuffer = async () => arrayBuffer;
  return file;
}

// Helper to create a regular file
function createMockFile(content: string, name: string, type = 'text/plain'): File {
  const file = new File([content], name, { type });
  // Add text method for Node.js compatibility
  (file as any).text = async () => content;
  return file;
}

describe('ZIP Utilities', () => {
  describe('isZipFile', () => {
    it('returns true for .zip files', () => {
      const zipFile = createMockFile('', 'archive.zip', 'application/zip');
      expect(isZipFile(zipFile)).toBe(true);
    });

    it('returns true for .ZIP files (case insensitive)', () => {
      const zipFile = createMockFile('', 'ARCHIVE.ZIP', 'application/zip');
      expect(isZipFile(zipFile)).toBe(true);
    });

    it('returns false for non-zip files', () => {
      const jsonFile = createMockFile('{}', 'data.json', 'application/json');
      const csvFile = createMockFile('a,b,c', 'data.csv', 'text/csv');

      expect(isZipFile(jsonFile)).toBe(false);
      expect(isZipFile(csvFile)).toBe(false);
    });
  });

  describe('extractZip', () => {
    it('extracts files from a ZIP archive', async () => {
      const zipFile = await createMockZip({
        'file1.json': '{"test": 1}',
        'file2.json': '{"test": 2}',
      });

      const result = await extractZip(zipFile);

      expect(result.files).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.files.map(f => f.name)).toContain('file1.json');
      expect(result.files.map(f => f.name)).toContain('file2.json');
    });

    it('extracts files from nested directories', async () => {
      const zipFile = await createMockZip({
        'folder/subfolder/data.json': '{"nested": true}',
      });

      const result = await extractZip(zipFile);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('data.json');
      expect(result.files[0].path).toBe('folder/subfolder/data.json');
    });

    it('skips directories', async () => {
      const zip = new JSZip();
      zip.folder('emptyFolder');
      zip.file('file.json', '{}');
      const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      const zipFile = new File([arrayBuffer], 'test.zip', { type: 'application/zip' });
      (zipFile as any).arrayBuffer = async () => arrayBuffer;

      const result = await extractZip(zipFile);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('file.json');
    });

    it('skips hidden files', async () => {
      const zipFile = await createMockZip({
        '.hidden': 'hidden content',
        'visible.json': '{}',
      });

      const result = await extractZip(zipFile);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('visible.json');
    });

    it('skips __MACOSX files', async () => {
      const zipFile = await createMockZip({
        '__MACOSX/._file.json': 'mac metadata',
        'file.json': '{}',
      });

      const result = await extractZip(zipFile);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('file.json');
    });

    it('applies filter function', async () => {
      const zipFile = await createMockZip({
        'data.json': '{}',
        'data.csv': 'a,b,c',
        'data.txt': 'text',
      });

      const result = await extractZip(zipFile, (path) => path.endsWith('.json'));

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('data.json');
    });

    it('returns error for invalid ZIP', async () => {
      const content = 'not a zip';
      const invalidFile = new File([content], 'fake.zip', { type: 'application/zip' });
      // Add arrayBuffer method for Node.js compatibility
      (invalidFile as any).arrayBuffer = async () => new TextEncoder().encode(content).buffer;

      const result = await extractZip(invalidFile);

      expect(result.files).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('extractZipByExtension', () => {
    it('extracts only files with specified extensions', async () => {
      const zipFile = await createMockZip({
        'data.json': '{}',
        'data.csv': 'a,b,c',
        'data.txt': 'text',
        'image.png': 'fake image',
      });

      const result = await extractZipByExtension(zipFile, ['.json', '.csv']);

      expect(result.files).toHaveLength(2);
      const names = result.files.map(f => f.name);
      expect(names).toContain('data.json');
      expect(names).toContain('data.csv');
    });

    it('handles extensions case-insensitively', async () => {
      const zipFile = await createMockZip({
        'DATA.JSON': '{}',
        'data.json': '{}',
      });

      const result = await extractZipByExtension(zipFile, ['.JSON']);

      expect(result.files).toHaveLength(2);
    });
  });

  describe('extractJsonFiles', () => {
    it('extracts only JSON files', async () => {
      const zipFile = await createMockZip({
        'data.json': '{"key": "value"}',
        'posts.json': '[]',
        'readme.txt': 'text content',
        'styles.css': '.class {}',
      });

      const result = await extractJsonFiles(zipFile);

      expect(result.files).toHaveLength(2);
      const names = result.files.map(f => f.name);
      expect(names).toContain('data.json');
      expect(names).toContain('posts.json');
    });
  });

  describe('extractCsvFiles', () => {
    it('extracts only CSV files', async () => {
      const zipFile = await createMockZip({
        'positions.csv': 'Company,Title\nAcme,Engineer',
        'education.csv': 'School,Degree\nMIT,BS',
        'data.json': '{}',
        'notes.txt': 'some notes',
      });

      const result = await extractCsvFiles(zipFile);

      expect(result.files).toHaveLength(2);
      const names = result.files.map(f => f.name);
      expect(names).toContain('positions.csv');
      expect(names).toContain('education.csv');
    });
  });

  describe('Extracted file content', () => {
    it('preserves file content correctly', async () => {
      const jsonContent = '{"test": "value", "number": 42}';
      const zipFile = await createMockZip({
        'data.json': jsonContent,
      });

      const result = await extractJsonFiles(zipFile);

      expect(result.files).toHaveLength(1);

      // Verify the extracted file has the right properties
      const extractedFile = result.files[0].file;
      expect(extractedFile.name).toBe('data.json');
      expect(extractedFile.size).toBe(jsonContent.length);
    });

    it('sets correct MIME type for JSON files', async () => {
      const zipFile = await createMockZip({
        'data.json': '{}',
      });

      const result = await extractJsonFiles(zipFile);

      expect(result.files[0].file.type).toBe('application/json');
    });

    it('sets correct MIME type for CSV files', async () => {
      const zipFile = await createMockZip({
        'data.csv': 'a,b,c',
      });

      const result = await extractCsvFiles(zipFile);

      expect(result.files[0].file.type).toBe('text/csv');
    });
  });

  describe('Empty ZIP handling', () => {
    it('handles empty ZIP archive', async () => {
      const zip = new JSZip();
      const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      const zipFile = new File([arrayBuffer], 'empty.zip', { type: 'application/zip' });
      (zipFile as any).arrayBuffer = async () => arrayBuffer;

      const result = await extractZip(zipFile);

      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('handles ZIP with only directories', async () => {
      const zip = new JSZip();
      zip.folder('folder1');
      zip.folder('folder2/subfolder');
      const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      const zipFile = new File([arrayBuffer], 'folders.zip', { type: 'application/zip' });
      (zipFile as any).arrayBuffer = async () => arrayBuffer;

      const result = await extractZip(zipFile);

      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
