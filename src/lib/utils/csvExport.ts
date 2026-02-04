/**
 * CSV export utilities
 */

/**
 * Escape a value for CSV format
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert an array of objects to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns?: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) {
    return '';
  }

  // Determine columns from first object if not provided
  const cols = columns || Object.keys(data[0]).map((key) => ({
    key: key as keyof T,
    header: key,
  }));

  // Header row
  const headerRow = cols.map((col) => escapeCSVValue(col.header)).join(',');

  // Data rows
  const dataRows = data.map((row) =>
    cols.map((col) => escapeCSVValue(row[col.key])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download a string as a file
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data as CSV file
 */
export function exportCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[]
): void {
  const csv = toCSV(data, columns);
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export timeline events trend data as CSV
 */
export function exportTrendDataCSV(
  eventsByYear: Record<number, number>,
  filename: string = 'timeline-trends.csv'
): void {
  const data = Object.entries(eventsByYear)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([year, count]) => ({
      year: Number(year),
      events: count,
    }));

  exportCSV(data, filename, [
    { key: 'year', header: 'Year' },
    { key: 'events', header: 'Event Count' },
  ]);
}

/**
 * Export layer distribution data as CSV
 */
export function exportLayerDataCSV(
  eventsByLayer: Record<string, number>,
  totalEvents: number,
  filename: string = 'layer-distribution.csv'
): void {
  const data = Object.entries(eventsByLayer)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([layer, count]) => ({
      layer: layer.charAt(0).toUpperCase() + layer.slice(1),
      count,
      percentage: totalEvents > 0 ? ((count / totalEvents) * 100).toFixed(1) + '%' : '0%',
    }));

  exportCSV(data, filename, [
    { key: 'layer', header: 'Layer' },
    { key: 'count', header: 'Event Count' },
    { key: 'percentage', header: 'Percentage' },
  ]);
}

/**
 * Export full insights report as CSV
 */
export function exportInsightsReportCSV(
  stats: {
    totalEvents: number;
    yearsOfData: number;
    eventsPerYear: number;
    eventsByLayer: Record<string, number>;
    eventsByYear: Record<number, number>;
    eventsBySource: Record<string, number>;
  },
  filename: string = 'insights-report.csv'
): void {
  // Create a summary section
  const summary = [
    { metric: 'Total Events', value: stats.totalEvents },
    { metric: 'Years of Data', value: stats.yearsOfData },
    { metric: 'Events per Year (average)', value: stats.eventsPerYear },
    { metric: '', value: '' }, // Empty row
    { metric: '--- Events by Layer ---', value: '' },
  ];

  // Add layer data
  Object.entries(stats.eventsByLayer)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([layer, count]) => {
      summary.push({
        metric: layer.charAt(0).toUpperCase() + layer.slice(1),
        value: count,
      });
    });

  // Add source data
  summary.push({ metric: '', value: '' });
  summary.push({ metric: '--- Events by Source ---', value: '' });

  Object.entries(stats.eventsBySource)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      summary.push({
        metric: source.charAt(0).toUpperCase() + source.slice(1),
        value: count,
      });
    });

  // Add yearly breakdown
  summary.push({ metric: '', value: '' });
  summary.push({ metric: '--- Events by Year ---', value: '' });

  Object.entries(stats.eventsByYear)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([year, count]) => {
      summary.push({ metric: year, value: count });
    });

  exportCSV(summary, filename, [
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: 'Value' },
  ]);
}
