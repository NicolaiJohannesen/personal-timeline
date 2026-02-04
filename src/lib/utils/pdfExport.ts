/**
 * PDF Export Utilities
 * Uses jsPDF-like approach for client-side PDF generation
 */

import type { TimelineEvent, Goal, UserProfile } from '@/types';

// Simple PDF generator using canvas and data URL approach
// For a full implementation, you would use a library like jsPDF or pdfmake

interface PDFSection {
  title: string;
  content: string[];
}

interface TimelineExportData {
  profile?: UserProfile | null;
  events: TimelineEvent[];
  goals: Goal[];
}

/**
 * Generate a printable HTML document that can be saved as PDF
 */
export function generatePrintableTimeline(data: TimelineExportData): string {
  const { profile, events, goals } = data;

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const eventsByYear: Record<number, TimelineEvent[]> = {};
  sortedEvents.forEach(event => {
    const year = new Date(event.startDate).getFullYear();
    if (!eventsByYear[year]) eventsByYear[year] = [];
    eventsByYear[year].push(event);
  });

  const years = Object.keys(eventsByYear).map(Number).sort((a, b) => b - a);

  const layerColors: Record<string, string> = {
    economics: '#22C55E',
    education: '#3B82F6',
    work: '#8B5CF6',
    health: '#EF4444',
    relationships: '#EC4899',
    travel: '#F97316',
    media: '#EAB308',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Personal Timeline - ${profile?.name || 'Life Story'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      background: #0D0D0D;
      color: #FFFFFF;
      padding: 40px;
      line-height: 1.6;
    }

    .header {
      text-align: center;
      margin-bottom: 60px;
      padding-bottom: 40px;
      border-bottom: 2px solid #F5A623;
    }

    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 48px;
      color: #F5A623;
      margin-bottom: 10px;
    }

    .subtitle {
      color: #A3A3A3;
      font-size: 18px;
    }

    .stats {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 30px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: #F5A623;
    }

    .stat-label {
      font-size: 14px;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .year-section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }

    .year-header {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      color: #F5A623;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }

    .event {
      display: flex;
      margin-bottom: 15px;
      padding: 15px;
      background: #1A1A1A;
      border-radius: 8px;
      border-left: 4px solid;
    }

    .event-date {
      width: 100px;
      flex-shrink: 0;
      color: #A3A3A3;
      font-size: 14px;
    }

    .event-content {
      flex: 1;
    }

    .event-title {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 5px;
    }

    .event-description {
      color: #A3A3A3;
      font-size: 14px;
    }

    .event-layer {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .goals-section {
      margin-top: 60px;
      padding-top: 40px;
      border-top: 2px solid #F5A623;
    }

    .goals-header {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      color: #F5A623;
      margin-bottom: 30px;
      text-align: center;
    }

    .goal {
      padding: 20px;
      background: #1A1A1A;
      border-radius: 8px;
      margin-bottom: 15px;
    }

    .goal-title {
      font-weight: 600;
      font-size: 18px;
      margin-bottom: 10px;
    }

    .goal-meta {
      color: #A3A3A3;
      font-size: 14px;
    }

    .footer {
      margin-top: 60px;
      text-align: center;
      color: #666666;
      font-size: 12px;
    }

    @media print {
      body {
        background: white;
        color: black;
      }

      .header {
        border-bottom-color: #F5A623;
      }

      .event {
        background: #f5f5f5;
      }

      .goal {
        background: #f5f5f5;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${profile?.name ? `${profile.name}'s Timeline` : 'My Life Timeline'}</h1>
    <p class="subtitle">A chronicle of life's moments</p>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${events.length}</div>
        <div class="stat-label">Events</div>
      </div>
      <div class="stat">
        <div class="stat-value">${years.length}</div>
        <div class="stat-label">Years</div>
      </div>
      <div class="stat">
        <div class="stat-value">${goals.filter(g => g.status === 'completed').length}</div>
        <div class="stat-label">Goals Achieved</div>
      </div>
    </div>
  </div>

  ${years.map(year => `
    <div class="year-section">
      <h2 class="year-header">${year}</h2>
      ${eventsByYear[year].map(event => `
        <div class="event" style="border-left-color: ${layerColors[event.layer] || '#F5A623'}">
          <div class="event-date">
            ${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <div class="event-content">
            <div class="event-title">${escapeHtml(event.title)}</div>
            ${event.description ? `<div class="event-description">${escapeHtml(event.description)}</div>` : ''}
            <span class="event-layer" style="background: ${layerColors[event.layer] || '#F5A623'}20; color: ${layerColors[event.layer] || '#F5A623'}">
              ${event.layer}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('')}

  ${goals.length > 0 ? `
    <div class="goals-section">
      <h2 class="goals-header">Dreams & Goals</h2>
      ${goals.map(goal => `
        <div class="goal">
          <div class="goal-title">${escapeHtml(goal.title)}</div>
          <div class="goal-meta">
            ${goal.category} • ${goal.status.replace('_', ' ')}
            ${goal.targetDate ? ` • Target: ${new Date(goal.targetDate).toLocaleDateString()}` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <div class="footer">
    <p>Generated by Personal Timeline • ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Open printable timeline in new window for PDF saving
 */
export function exportTimelinePDF(data: TimelineExportData): void {
  const html = generatePrintableTimeline(data);
  const printWindow = window.open('', '_blank');

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for fonts to load, then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
}

/**
 * Download timeline as HTML file (can be opened in browser and saved as PDF)
 */
export function downloadTimelineHTML(data: TimelineExportData): void {
  const html = generatePrintableTimeline(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `timeline-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
