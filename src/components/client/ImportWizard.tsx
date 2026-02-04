'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { timelineEvents } from '@/lib/db';
import {
  parseFacebookData,
  parseLinkedInData,
  parseGoogleData,
  parseCSVAuto,
  previewCSV,
  type ImportResult,
  type ParsedEvent,
} from '@/lib/import';
import type { TimelineEvent, EventSource } from '@/types';
import { createAbortController, isAbortError } from '@/lib/utils/asyncCleanup';

type ImportSource = 'facebook' | 'linkedin' | 'google' | 'csv';
type WizardStep = 'source' | 'upload' | 'preview' | 'confirm';

interface SourceConfig {
  id: ImportSource;
  name: string;
  description: string;
  acceptedFiles: string;
  icon: React.ReactNode;
  color: string;
  instructions: string[];
}

const SOURCES: SourceConfig[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Import posts, photos, events, and friends',
    acceptedFiles: '.json,.zip',
    color: 'rgb(59, 89, 152)',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    instructions: [
      'Go to Facebook Settings & Privacy → Settings',
      'Click "Your Facebook Information" → "Download Your Information"',
      'Select JSON format and choose the data you want',
      'Click "Create File" and wait for download',
      'Upload the ZIP archive or JSON files here',
    ],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Import jobs, education, and connections',
    acceptedFiles: '.csv,.zip',
    color: 'rgb(10, 102, 194)',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    instructions: [
      'Go to LinkedIn Settings → Data Privacy',
      'Click "Get a copy of your data"',
      'Select the data you want to download',
      'Request the archive and wait for email',
      'Upload the ZIP archive or CSV files here',
    ],
  },
  {
    id: 'google',
    name: 'Google Takeout',
    description: 'Import from Keep, Photos, Calendar, Location History',
    acceptedFiles: '.json,.zip',
    color: 'rgb(66, 133, 244)',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
      </svg>
    ),
    instructions: [
      'Go to takeout.google.com',
      'Select the products you want to export',
      'Choose your export format and frequency',
      'Create and download your archive',
      'Upload the ZIP archive or JSON files here',
    ],
  },
  {
    id: 'csv',
    name: 'Custom CSV',
    description: 'Import from a custom spreadsheet',
    acceptedFiles: '.csv,.zip',
    color: 'var(--color-text-secondary)',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    instructions: [
      'Prepare a CSV file with columns for Title, Date, and optionally Description, Category',
      'Ensure dates are in YYYY-MM-DD or similar format',
      'Save the file with .csv extension',
      'Upload the CSV file or a ZIP archive here',
    ],
  },
];

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>('source');
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  // Abort controller for cancelling ongoing operations
  const abortControllerRef = useRef<{ isAborted: () => boolean; cleanup: () => void } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.cleanup();
    };
  }, []);

  // Filtering and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLayer, setFilterLayer] = useState<string | null>(null);
  const [filterEventType, setFilterEventType] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 50;

  const sourceConfig = SOURCES.find((s) => s.id === selectedSource);

  // Compute filtered events
  const filteredEvents = importResult?.events.filter((event, index) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Layer filter
    if (filterLayer && event.layer !== filterLayer) return false;

    // Event type filter
    if (filterEventType && event.eventType !== filterEventType) return false;

    return true;
  }) || [];

  // Map filtered events back to their original indices
  const filteredIndices = importResult?.events
    .map((_, i) => i)
    .filter((i) => {
      const event = importResult.events[i];
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.title.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (filterLayer && event.layer !== filterLayer) return false;
      if (filterEventType && event.eventType !== filterEventType) return false;
      return true;
    }) || [];

  // Paginate filtered events
  const totalPages = Math.ceil(filteredEvents.length / PAGE_SIZE);
  const paginatedEvents = filteredEvents.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  const paginatedIndices = filteredIndices.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // Get unique layers and event types for filters
  const availableLayers = [...new Set(importResult?.events.map(e => e.layer) || [])];
  const availableEventTypes = [...new Set(importResult?.events.map(e => e.eventType) || [])];

  // Count selected in current filter
  const selectedInFilter = filteredIndices.filter(i => selectedEvents.has(i)).length;

  // Prevent browser from opening files when dropped outside the drop zone
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    if (step === 'upload') {
      document.addEventListener('dragover', preventDefaults);
      document.addEventListener('drop', preventDefaults);
    }

    return () => {
      document.removeEventListener('dragover', preventDefaults);
      document.removeEventListener('drop', preventDefaults);
    };
  }, [step]);

  const handleSourceSelect = (source: ImportSource) => {
    setSelectedSource(source);
    setStep('upload');
  };

  const processFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    // Cancel any previous operation
    abortControllerRef.current?.cleanup();
    const { isAborted, cleanup } = createAbortController();
    abortControllerRef.current = { isAborted, cleanup };

    setFiles(selectedFiles);
    setIsProcessing(true);

    try {
      let result: ImportResult;

      switch (selectedSource) {
        case 'facebook':
          result = await parseFacebookData(selectedFiles);
          break;
        case 'linkedin':
          result = await parseLinkedInData(selectedFiles);
          break;
        case 'google':
          result = await parseGoogleData(selectedFiles);
          break;
        case 'csv':
          if (selectedFiles.length > 0) {
            result = await parseCSVAuto(selectedFiles[0]);
          } else {
            throw new Error('No file selected');
          }
          break;
        default:
          throw new Error('Unknown source');
      }

      // Check if operation was cancelled
      if (isAborted()) return;

      setImportResult(result);
      // Select all events by default
      setSelectedEvents(new Set(result.events.map((_, i) => i)));
      setStep('preview');
    } catch (error) {
      // Don't update state if cancelled or aborted
      if (isAborted() || isAbortError(error)) return;

      console.error('Import failed:', error);
      setImportResult({
        events: [],
        errors: [{ message: error instanceof Error ? error.message : 'Import failed' }],
        stats: { totalFiles: selectedFiles.length, processedFiles: 0, totalEvents: 0, eventsByLayer: {}, skipped: 0 },
      });
    } finally {
      if (!isAborted()) {
        setIsProcessing(false);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    await processFiles(selectedFiles);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  }, [selectedSource]);

  const toggleEvent = (index: number) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAllEvents = () => {
    if (selectedEvents.size === importResult?.events.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(importResult?.events.map((_, i) => i) || []));
    }
  };

  const toggleFilteredEvents = () => {
    const allFilteredSelected = filteredIndices.every(i => selectedEvents.has(i));
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        // Deselect all filtered
        filteredIndices.forEach(i => next.delete(i));
      } else {
        // Select all filtered
        filteredIndices.forEach(i => next.add(i));
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterLayer(null);
    setFilterEventType(null);
    setCurrentPage(0);
  };

  const handleImport = async () => {
    if (!importResult) return;

    // Cancel any previous operation
    abortControllerRef.current?.cleanup();
    const { isAborted, cleanup } = createAbortController();
    abortControllerRef.current = { isAborted, cleanup };

    setIsProcessing(true);
    try {
      const eventsToImport = importResult.events.filter((_, i) => selectedEvents.has(i));

      // Prepare all events for batch import
      const fullEvents: TimelineEvent[] = eventsToImport.map((event) => ({
        id: crypto.randomUUID(),
        userId: 'default-user',
        ...event,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Check if operation was cancelled before batch import
      if (isAborted()) return;

      // Use batch import for better performance and atomicity
      const addedEvents = await timelineEvents.addBatch(fullEvents);

      // Check if operation was cancelled
      if (isAborted()) return;

      setImportedCount(addedEvents.length);
      setImportComplete(true);
      setStep('confirm');
    } catch (error) {
      // Don't update state if cancelled or aborted
      if (isAborted() || isAbortError(error)) return;

      console.error('Failed to save events:', error);
    } finally {
      if (!isAborted()) {
        setIsProcessing(false);
      }
    }
  };

  const handleReset = () => {
    // Cancel any ongoing operations
    abortControllerRef.current?.cleanup();
    abortControllerRef.current = null;

    setStep('source');
    setSelectedSource(null);
    setFiles([]);
    setImportResult(null);
    setSelectedEvents(new Set());
    setImportComplete(false);
    setImportedCount(0);
    setIsProcessing(false);
  };

  const handleBack = () => {
    // Cancel any ongoing operations when navigating back
    abortControllerRef.current?.cleanup();
    abortControllerRef.current = null;
    setIsProcessing(false);

    switch (step) {
      case 'upload':
        setStep('source');
        setSelectedSource(null);
        break;
      case 'preview':
        setStep('upload');
        setFiles([]);
        setImportResult(null);
        break;
      case 'confirm':
        if (!importComplete) {
          setStep('preview');
        }
        break;
    }
  };

  return (
    <div className="fade-in max-w-4xl">
      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {(['source', 'upload', 'preview', 'confirm'] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                  : i < ['source', 'upload', 'preview', 'confirm'].indexOf(step)
                  ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              {i + 1}
            </div>
            {i < 3 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  i < ['source', 'upload', 'preview', 'confirm'].indexOf(step)
                    ? 'bg-[var(--color-accent-primary)]'
                    : 'bg-[var(--color-border)]'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step: Source Selection */}
      {step === 'source' && (
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Import Data</h1>
            <p className="text-[var(--color-text-secondary)]">
              Choose a source to import your life data from
            </p>
          </div>

          {/* Privacy Notice */}
          <div className="card mb-6 border-l-4 border-l-[var(--color-accent-primary)]">
            <div className="flex gap-3">
              <svg
                className="w-6 h-6 text-[var(--color-accent-primary)] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <div>
                <h3 className="font-semibold mb-1">Your data stays on your device</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  All file processing happens locally in your browser. Your data is never uploaded
                  to any servers.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {SOURCES.map((source) => (
              <button
                key={source.id}
                onClick={() => handleSourceSelect(source.id)}
                className="card w-full text-left hover:border-[var(--color-border)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${source.color}20`, color: source.color }}
                  >
                    {source.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{source.name}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {source.description}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-[var(--color-text-muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && sourceConfig && (
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Upload {sourceConfig.name} Data</h1>
            <p className="text-[var(--color-text-secondary)]">
              Follow the instructions below to export and upload your data
            </p>
          </div>

          {/* Instructions */}
          <div className="card mb-6">
            <h3 className="font-semibold mb-3">How to export your data</h3>
            <ol className="space-y-2">
              {sourceConfig.instructions.map((instruction, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] flex items-center justify-center flex-shrink-0 text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* File Upload */}
          <div
            className={`card-elevated border-2 border-dashed transition-colors cursor-pointer ${
              isDragging
                ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-accent-primary)]'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={sourceConfig.acceptedFiles}
              multiple={sourceConfig.id !== 'csv'}
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="py-12 text-center">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full" />
                  <p className="text-[var(--color-text-secondary)]">Processing files...</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-accent-primary)]/10 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-[var(--color-accent-primary)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-medium mb-1">
                    Drop {sourceConfig.acceptedFiles.includes('.zip') ? 'ZIP archive or ' : ''}{sourceConfig.acceptedFiles.replace(',.zip', '')} files here
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    or click to browse your files
                  </p>
                </>
              )}
            </div>
          </div>

          {files.length > 0 && !isProcessing && (
            <div className="mt-4 p-4 bg-[var(--color-bg-secondary)] rounded-lg">
              <p className="text-sm font-medium mb-2">Selected files:</p>
              <ul className="space-y-1">
                {files.map((file, i) => (
                  <li key={i} className="text-sm text-[var(--color-text-secondary)]">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={handleBack} className="btn btn-ghost">
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && importResult && (
        <div>
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Review Import</h1>
            <p className="text-[var(--color-text-secondary)]">
              {importResult.stats.totalEvents.toLocaleString()} events found.
              Select which ones to import.
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="card py-3">
              <div className="text-2xl font-bold text-[var(--color-accent-primary)]">
                {importResult.stats.totalEvents.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Total Events</div>
            </div>
            <div className="card py-3">
              <div className="text-2xl font-bold text-[var(--color-success)]">
                {selectedEvents.size.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Selected</div>
            </div>
            <div className="card py-3">
              <div className="text-2xl font-bold text-[var(--color-layer-work)]">
                {importResult.stats.processedFiles}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Files Parsed</div>
            </div>
            <div className="card py-3">
              <div className="text-2xl font-bold text-[var(--color-error)]">
                {importResult.errors.length}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Errors</div>
            </div>
          </div>

          {/* Layer breakdown - clickable filters */}
          {Object.keys(importResult.stats.eventsByLayer).length > 0 && (
            <div className="card mb-6">
              <h3 className="font-semibold mb-3">Events by Category</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(importResult.stats.eventsByLayer).map(([layer, count]) => (
                  <button
                    key={layer}
                    onClick={() => setFilterLayer(filterLayer === layer ? null : layer)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filterLayer === layer
                        ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                        : 'bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    {layer}: {count?.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Errors (collapsible) */}
          {importResult.errors.length > 0 && (
            <details className="card mb-6 border-l-4 border-l-[var(--color-error)]">
              <summary className="cursor-pointer font-semibold text-[var(--color-error)]">
                {importResult.errors.length} Import Errors
              </summary>
              <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {importResult.errors.slice(0, 10).map((error, i) => (
                  <li key={i}>
                    {error.file && <span className="font-medium">{error.file}: </span>}
                    {error.message}
                  </li>
                ))}
                {importResult.errors.length > 10 && (
                  <li className="text-[var(--color-text-muted)]">
                    ...and {importResult.errors.length - 10} more errors
                  </li>
                )}
              </ul>
            </details>
          )}

          {/* Events List with Filters */}
          {importResult.events.length > 0 && (
            <div className="card mb-6">
              {/* Filter Bar */}
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                {/* Search */}
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:border-[var(--color-accent-primary)] focus:outline-none"
                  />
                </div>

                {/* Event Type Filter */}
                {availableEventTypes.length > 1 && (
                  <select
                    value={filterEventType || ''}
                    onChange={(e) => { setFilterEventType(e.target.value || null); setCurrentPage(0); }}
                    className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:border-[var(--color-accent-primary)] focus:outline-none"
                  >
                    <option value="">All Types</option>
                    {availableEventTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                )}

                {/* Clear Filters */}
                {(searchQuery || filterLayer || filterEventType) && (
                  <button onClick={clearFilters} className="btn btn-ghost text-sm whitespace-nowrap">
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Selection Controls */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-border)]">
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Showing {paginatedEvents.length.toLocaleString()} of {filteredEvents.length.toLocaleString()} events
                  {(searchQuery || filterLayer || filterEventType) && (
                    <span className="text-[var(--color-text-muted)]"> (filtered)</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={toggleFilteredEvents}
                    className="btn btn-ghost text-sm"
                  >
                    {filteredIndices.every(i => selectedEvents.has(i))
                      ? `Deselect ${filteredEvents.length > 100 ? 'Visible' : 'All'} (${filteredEvents.length})`
                      : `Select ${filteredEvents.length > 100 ? 'Visible' : 'All'} (${filteredEvents.length})`}
                  </button>
                </div>
              </div>

              {/* Events */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {paginatedEvents.map((event, i) => {
                  const originalIndex = paginatedIndices[i];
                  return (
                    <label
                      key={originalIndex}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedEvents.has(originalIndex)
                          ? 'bg-[var(--color-accent-primary)]/10'
                          : 'bg-[var(--color-bg-secondary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.has(originalIndex)}
                        onChange={() => toggleEvent(originalIndex)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{event.title}</span>
                          <span className={`badge badge-${event.layer}`} style={{ fontSize: '0.65rem' }}>
                            {event.layer}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                            {event.eventType}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mt-1">
                            {event.description}
                          </p>
                        )}
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {event.startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border)]">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="btn btn-ghost text-sm disabled:opacity-50"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="btn btn-ghost text-sm disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={handleBack} className="btn btn-ghost">
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={selectedEvents.size === 0 || isProcessing}
              className="btn btn-primary"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Importing...
                </>
              ) : (
                <>Import {selectedEvents.size.toLocaleString()} Events</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-[var(--color-success)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">Import Complete!</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Successfully imported {importedCount} events to your timeline
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleReset} className="btn btn-ghost">
              Import More
            </button>
            <a href="/timeline" className="btn btn-primary">
              View Timeline
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportWizard;
