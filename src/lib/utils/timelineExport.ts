/**
 * Timeline export utilities
 * Supports PNG, SVG, and PDF export
 */

/**
 * Export canvas as PNG image
 */
export function exportCanvasAsPNG(
  canvas: HTMLCanvasElement,
  filename: string = 'timeline.png'
): void {
  const dataUrl = canvas.toDataURL('image/png');
  downloadDataUrl(dataUrl, filename);
}

/**
 * Export canvas as JPEG image
 */
export function exportCanvasAsJPEG(
  canvas: HTMLCanvasElement,
  filename: string = 'timeline.jpg',
  quality: number = 0.9
): void {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  downloadDataUrl(dataUrl, filename);
}

/**
 * Create SVG from timeline data
 */
export function createTimelineSVG(
  events: Array<{
    title: string;
    startDate: Date;
    layer: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>,
  options: {
    width: number;
    height: number;
    backgroundColor?: string;
  }
): string {
  const { width, height, backgroundColor = '#0d0d0d' } = options;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <style>
    .event-rect { stroke-width: 1; }
    .event-text { font-family: system-ui, sans-serif; font-size: 11px; fill: rgba(0,0,0,0.8); }
  </style>
  <g id="events">
`;

  for (const event of events) {
    svg += `    <g class="event">
      <rect class="event-rect" x="${event.x}" y="${event.y}" width="${event.width}" height="${event.height}" fill="${event.color}cc" stroke="${event.color}" rx="4"/>
      ${event.width > 50 ? `<text class="event-text" x="${event.x + 4}" y="${event.y + event.height / 2 + 4}">${escapeXml(truncateText(event.title, 20))}</text>` : ''}
    </g>
`;
  }

  svg += `  </g>
</svg>`;

  return svg;
}

/**
 * Export as SVG file
 */
export function exportTimelineSVG(
  svgContent: string,
  filename: string = 'timeline.svg'
): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Generate simple PDF from canvas
 * Note: This creates a basic PDF without external dependencies
 */
export function exportTimelineAsPDF(
  canvas: HTMLCanvasElement,
  title: string = 'Personal Timeline',
  filename: string = 'timeline.pdf'
): void {
  // Convert canvas to base64 JPEG
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // Create a simple PDF manually (without external library)
  // This is a minimal PDF that embeds the image
  const pdf = createSimplePDF(imgData, canvas.width, canvas.height, title);

  const blob = new Blob([pdf], { type: 'application/pdf' });
  downloadBlob(blob, filename);
}

/**
 * Create a simple PDF with embedded image
 * This creates a valid PDF without external dependencies
 */
function createSimplePDF(
  imageDataUrl: string,
  imgWidth: number,
  imgHeight: number,
  title: string
): Uint8Array {
  // Extract base64 data
  const base64Data = imageDataUrl.split(',')[1];
  const imageBytes = atob(base64Data);

  // Calculate page dimensions (A4 landscape for timeline)
  const pageWidth = 842; // A4 landscape width in points
  const pageHeight = 595; // A4 landscape height in points

  // Scale image to fit page
  const scale = Math.min(
    (pageWidth - 40) / imgWidth,
    (pageHeight - 80) / imgHeight
  );
  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;
  const xOffset = (pageWidth - scaledWidth) / 2;
  const yOffset = (pageHeight - scaledHeight) / 2;

  // Build PDF content
  const objects: string[] = [];
  let objectCount = 0;
  const objectOffsets: number[] = [];

  // Helper to add object
  const addObject = (content: string): number => {
    objectCount++;
    objectOffsets.push(0); // Will be updated later
    objects.push(content);
    return objectCount;
  };

  // Object 1: Catalog
  addObject(`1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj`);

  // Object 2: Pages
  addObject(`2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj`);

  // Object 3: Page
  addObject(`3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> /Font << /F1 6 0 R >> >> >>
endobj`);

  // Object 4: Content stream
  const contentStream = `BT
/F1 16 Tf
20 ${pageHeight - 30} Td
(${title}) Tj
ET
q
${scaledWidth} 0 0 ${scaledHeight} ${xOffset} ${yOffset} cm
/Img Do
Q`;

  addObject(`4 0 obj
<< /Length ${contentStream.length} >>
stream
${contentStream}
endstream
endobj`);

  // Object 5: Image XObject
  addObject(`5 0 obj
<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>
stream
${imageBytes}
endstream
endobj`);

  // Object 6: Font
  addObject(`6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj`);

  // Build PDF
  let pdf = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';

  // Add objects and track offsets
  for (let i = 0; i < objects.length; i++) {
    objectOffsets[i] = pdf.length;
    pdf += objects[i] + '\n';
  }

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objectCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 0; i < objectCount; i++) {
    pdf += objectOffsets[i].toString().padStart(10, '0') + ' 00000 n \n';
  }

  // Trailer
  pdf += 'trailer\n';
  pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += xrefOffset + '\n';
  pdf += '%%EOF';

  // Convert to Uint8Array for binary data
  const encoder = new TextEncoder();
  return encoder.encode(pdf);
}

/**
 * Helper to download a data URL
 */
function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper to download a blob
 */
function downloadBlob(blob: Blob, filename: string): void {
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
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Export timeline data as JSON backup
 */
export function exportTimelineJSON(
  events: Array<Record<string, unknown>>,
  profile: Record<string, unknown> | null,
  goals: Array<Record<string, unknown>>,
  filename: string = 'timeline-backup.json'
): void {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    profile,
    events,
    goals,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
}
