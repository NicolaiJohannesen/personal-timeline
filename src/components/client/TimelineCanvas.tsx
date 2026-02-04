'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { TimelineEvent, DataLayer, Goal, GoalCategory } from '@/types';

// Map goal categories to data layers for display purposes
const GOAL_CATEGORY_TO_LAYER: Record<GoalCategory, DataLayer> = {
  career: 'work',
  health: 'health',
  finance: 'economics',
  personal: 'media',
  relationship: 'relationships',
  travel: 'travel',
};

// Layer colors matching the design system
const LAYER_COLORS: Record<DataLayer, string> = {
  economics: '#4ade80',     // green
  education: '#3b82f6',     // blue
  work: '#8b5cf6',          // purple
  health: '#ef4444',        // red
  relationships: '#ec4899', // pink
  travel: '#f97316',        // orange
  media: '#eab308',         // yellow
};

interface TimelineCanvasProps {
  events: TimelineEvent[];
  birthYear: number;
  expectedLifespan?: number;
  onEventClick?: (event: TimelineEvent) => void;
  onEventHover?: (event: TimelineEvent | null) => void;
  visibleLayers?: DataLayer[];
  showMortalityCurve?: boolean;
  showFutureGoals?: boolean;
  futureGoals?: Goal[];
  onGoalClick?: (goal: Goal) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  className?: string;
}

// Zoom presets for different time scales
type ZoomPreset = 'decade' | 'year' | 'month' | 'week';

const ZOOM_PRESETS: Record<ZoomPreset, { scale: number; label: string }> = {
  decade: { scale: 0.15, label: 'Decade' },
  year: { scale: 1, label: 'Year' },
  month: { scale: 3, label: 'Month' },
  week: { scale: 12, label: 'Week' },
};

interface CanvasState {
  offsetX: number;
  scale: number;
  isDragging: boolean;
  dragStartX: number;
  lastOffsetX: number;
}

interface EventPosition {
  event: TimelineEvent;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_LIFESPAN = 85;
const YEAR_WIDTH = 40; // Base pixels per year
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const LANE_HEIGHT = 30;
const LANE_GAP = 8;
const TOP_PADDING = 60;
const BOTTOM_PADDING = 40;

export function TimelineCanvas({
  events,
  birthYear,
  expectedLifespan = DEFAULT_LIFESPAN,
  onEventClick,
  onEventHover,
  visibleLayers,
  showMortalityCurve = true,
  showFutureGoals = true,
  futureGoals = [],
  onGoalClick,
  canvasRef: externalCanvasRef,
  className = '',
}: TimelineCanvasProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [state, setState] = useState<CanvasState>({
    offsetX: 0,
    scale: 1,
    isDragging: false,
    dragStartX: 0,
    lastOffsetX: 0,
  });
  const [eventPositions, setEventPositions] = useState<EventPosition[]>([]);
  const [goalPositions, setGoalPositions] = useState<{ goal: Goal; x: number; y: number; width: number; height: number }[]>([]);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [hoveredGoal, setHoveredGoal] = useState<Goal | null>(null);

  // Filter events by visible layers
  const filteredEvents = visibleLayers
    ? events.filter((e) => visibleLayers.includes(e.layer))
    : events;

  // Get the end year for the timeline
  const endYear = birthYear + expectedLifespan;
  const currentYear = new Date().getFullYear();

  // Year to X position conversion
  const yearToX = useCallback(
    (year: number): number => {
      return (year - birthYear) * YEAR_WIDTH * state.scale + state.offsetX;
    },
    [birthYear, state.scale, state.offsetX]
  );

  // X position to year conversion
  const xToYear = useCallback(
    (x: number): number => {
      return (x - state.offsetX) / (YEAR_WIDTH * state.scale) + birthYear;
    },
    [birthYear, state.scale, state.offsetX]
  );

  // Draw mortality curve
  const drawMortalityCurve = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { width, height } = dimensions;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.15)'; // amber with low opacity
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(245, 166, 35, 0.05)';

      // Simplified mortality curve (Gompertz-like)
      const points: [number, number][] = [];
      for (let age = 0; age <= expectedLifespan; age++) {
        const x = yearToX(birthYear + age);
        // Simple approximation: exponential increase after middle age
        const mortalityRate = age < 50
          ? 0.01 * Math.pow(1.05, age)
          : 0.01 * Math.pow(1.09, age);
        const y = height - BOTTOM_PADDING - (mortalityRate * 500);
        points.push([x, Math.max(TOP_PADDING, Math.min(y, height - BOTTOM_PADDING))]);
      }

      if (points.length > 0) {
        ctx.moveTo(points[0][0], height - BOTTOM_PADDING);
        ctx.lineTo(points[0][0], points[0][1]);

        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1]);
        }

        ctx.lineTo(points[points.length - 1][0], height - BOTTOM_PADDING);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },
    [dimensions, yearToX, birthYear, expectedLifespan]
  );

  // Draw timeline axis
  const drawAxis = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { width, height } = dimensions;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '12px system-ui, sans-serif';

      // Determine year interval based on scale
      let yearInterval = 1;
      if (state.scale < 0.3) yearInterval = 10;
      else if (state.scale < 0.6) yearInterval = 5;
      else if (state.scale < 1.5) yearInterval = 2;

      // Draw year markers
      for (let year = birthYear; year <= endYear; year += yearInterval) {
        const x = yearToX(year);
        if (x < -50 || x > width + 50) continue;

        // Vertical gridline
        ctx.beginPath();
        ctx.moveTo(x, TOP_PADDING);
        ctx.lineTo(x, height - BOTTOM_PADDING);
        ctx.stroke();

        // Year label
        const age = year - birthYear;
        const label = `${year} (${age})`;
        ctx.fillText(label, x - 20, height - BOTTOM_PADDING + 20);
      }

      // Current year marker
      const currentX = yearToX(currentYear);
      if (currentX >= 0 && currentX <= width) {
        ctx.strokeStyle = 'rgba(245, 166, 35, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(currentX, TOP_PADDING);
        ctx.lineTo(currentX, height - BOTTOM_PADDING);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(245, 166, 35, 1)';
        ctx.fillText('NOW', currentX - 15, TOP_PADDING - 10);
      }
    },
    [dimensions, state.scale, birthYear, endYear, yearToX, currentYear]
  );

  // Draw events
  const drawEvents = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { height } = dimensions;
      const positions: EventPosition[] = [];

      // Group events by layer for lane assignment
      const layerOrder: DataLayer[] = [
        'work',
        'education',
        'economics',
        'health',
        'relationships',
        'travel',
        'media',
      ];

      const layerLanes: Record<DataLayer, number> = {} as Record<DataLayer, number>;
      let currentLane = 0;
      for (const layer of layerOrder) {
        if (!visibleLayers || visibleLayers.includes(layer)) {
          layerLanes[layer] = currentLane++;
        }
      }

      // Sort events by start date
      const sortedEvents = [...filteredEvents].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      for (const event of sortedEvents) {
        const startDate = new Date(event.startDate);
        const endDate = event.endDate ? new Date(event.endDate) : startDate;

        const startYear = startDate.getFullYear() + startDate.getMonth() / 12;
        const endYear = endDate.getFullYear() + endDate.getMonth() / 12;

        const x = yearToX(startYear);
        const eventWidth = Math.max(
          (endYear - startYear) * YEAR_WIDTH * state.scale,
          8 // Minimum width for point events
        );

        const lane = layerLanes[event.layer] ?? 0;
        const y = TOP_PADDING + lane * (LANE_HEIGHT + LANE_GAP);
        const eventHeight = LANE_HEIGHT;

        // Skip if off-screen
        if (x + eventWidth < 0 || x > dimensions.width) continue;

        // Draw event
        const color = LAYER_COLORS[event.layer];
        const isHovered = hoveredEvent?.id === event.id;

        ctx.fillStyle = isHovered ? color : `${color}cc`;
        ctx.strokeStyle = color;
        ctx.lineWidth = isHovered ? 2 : 1;

        // Rounded rectangle
        const radius = 4;
        ctx.beginPath();
        ctx.roundRect(x, y, eventWidth, eventHeight, radius);
        ctx.fill();
        ctx.stroke();

        // Draw title if there's enough space
        if (eventWidth > 50) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.font = '11px system-ui, sans-serif';
          const maxTextWidth = eventWidth - 8;
          let title = event.title;
          while (ctx.measureText(title).width > maxTextWidth && title.length > 3) {
            title = title.slice(0, -4) + '...';
          }
          ctx.fillText(title, x + 4, y + eventHeight / 2 + 4);
        }

        positions.push({ event, x, y, width: eventWidth, height: eventHeight });
      }

      setEventPositions(positions);
    },
    [dimensions, filteredEvents, visibleLayers, yearToX, state.scale, hoveredEvent]
  );

  // Draw future goals
  const drawFutureGoals = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!showFutureGoals || futureGoals.length === 0) {
        setGoalPositions([]);
        return;
      }

      const positions: { goal: Goal; x: number; y: number; width: number; height: number }[] = [];
      const now = new Date();

      // Filter goals with target dates in the future
      const validGoals = futureGoals.filter(
        (g) => g.targetDate && new Date(g.targetDate) > now && g.status !== 'completed' && g.status !== 'abandoned'
      );

      // Layer lanes calculation (same as events)
      const layerOrder: DataLayer[] = ['work', 'education', 'economics', 'health', 'relationships', 'travel', 'media'];
      const layerLanes: Record<DataLayer, number> = {} as Record<DataLayer, number>;
      let currentLane = 0;
      for (const layer of layerOrder) {
        if (!visibleLayers || visibleLayers.includes(layer)) {
          layerLanes[layer] = currentLane++;
        }
      }

      for (const goal of validGoals) {
        if (!goal.targetDate) continue;

        const targetDate = new Date(goal.targetDate);
        const targetYear = targetDate.getFullYear() + targetDate.getMonth() / 12;
        const x = yearToX(targetYear);
        const goalWidth = 60; // Fixed width for goals

        const layer = GOAL_CATEGORY_TO_LAYER[goal.category] || 'media';
        const lane = layerLanes[layer] ?? 0;
        const y = TOP_PADDING + lane * (LANE_HEIGHT + LANE_GAP);

        // Skip if off-screen
        if (x + goalWidth < 0 || x > dimensions.width) continue;

        const color = LAYER_COLORS[layer];
        const isHovered = hoveredGoal?.id === goal.id;

        // Draw future goal with dashed border (distinct visual style)
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.fillStyle = isHovered ? `${color}40` : `${color}20`;
        ctx.strokeStyle = color;
        ctx.lineWidth = isHovered ? 2 : 1;

        // Diamond/rhombus shape for goals to differentiate from events
        const cx = x + goalWidth / 2;
        const cy = y + LANE_HEIGHT / 2;
        const rx = goalWidth / 2;
        const ry = LANE_HEIGHT / 2;

        ctx.beginPath();
        ctx.moveTo(cx, cy - ry);
        ctx.lineTo(cx + rx, cy);
        ctx.lineTo(cx, cy + ry);
        ctx.lineTo(cx - rx, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Draw "GOAL" label
        ctx.fillStyle = color;
        ctx.font = '9px system-ui, sans-serif';
        ctx.fillText('GOAL', x + 15, y - 4);

        positions.push({ goal, x, y, width: goalWidth, height: LANE_HEIGHT });
      }

      // Draw connecting lines from now to goals
      const currentX = yearToX(now.getFullYear() + now.getMonth() / 12);
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.3)';
      ctx.lineWidth = 1;

      for (const pos of positions) {
        const goalCenterY = pos.y + LANE_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(currentX, goalCenterY);
        ctx.lineTo(pos.x, goalCenterY);
        ctx.stroke();
      }
      ctx.restore();

      setGoalPositions(positions);
    },
    [dimensions, futureGoals, showFutureGoals, visibleLayers, yearToX, hoveredGoal]
  );

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = dimensions;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = 'var(--color-bg-primary, #0d0d0d)';
    ctx.fillRect(0, 0, width, height);

    // Draw layers
    if (showMortalityCurve) {
      drawMortalityCurve(ctx);
    }
    drawAxis(ctx);
    drawEvents(ctx);
    drawFutureGoals(ctx);
  }, [dimensions, drawMortalityCurve, drawAxis, drawEvents, drawFutureGoals, showMortalityCurve]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Set canvas size and redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    draw();
  }, [dimensions, draw]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setState((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX,
      lastOffsetX: prev.offsetX,
    }));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for event hover
    const hoveredEventPos = eventPositions.find(
      (pos) =>
        x >= pos.x &&
        x <= pos.x + pos.width &&
        y >= pos.y &&
        y <= pos.y + pos.height
    );

    // Check for goal hover
    const hoveredGoalPos = goalPositions.find(
      (pos) =>
        x >= pos.x &&
        x <= pos.x + pos.width &&
        y >= pos.y &&
        y <= pos.y + pos.height
    );

    if (hoveredEventPos?.event !== hoveredEvent) {
      setHoveredEvent(hoveredEventPos?.event || null);
      onEventHover?.(hoveredEventPos?.event || null);
    }

    if (hoveredGoalPos?.goal !== hoveredGoal) {
      setHoveredGoal(hoveredGoalPos?.goal || null);
    }

    canvas.style.cursor = hoveredEventPos || hoveredGoalPos ? 'pointer' : 'grab';

    // Handle dragging
    if (state.isDragging) {
      const deltaX = e.clientX - state.dragStartX;
      setState((prev) => ({
        ...prev,
        offsetX: prev.lastOffsetX + deltaX,
      }));
      canvas.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = () => {
    setState((prev) => ({ ...prev, isDragging: false }));
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredEvent || hoveredGoal ? 'pointer' : 'grab';
    }
  };

  const handleMouseLeave = () => {
    setState((prev) => ({ ...prev, isDragging: false }));
    setHoveredEvent(null);
    setHoveredGoal(null);
    onEventHover?.(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (state.isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for event click
    const clickedEvent = eventPositions.find(
      (pos) =>
        x >= pos.x &&
        x <= pos.x + pos.width &&
        y >= pos.y &&
        y <= pos.y + pos.height
    );

    if (clickedEvent) {
      onEventClick?.(clickedEvent.event);
      return;
    }

    // Check for goal click
    const clickedGoal = goalPositions.find(
      (pos) =>
        x >= pos.x &&
        x <= pos.x + pos.width &&
        y >= pos.y &&
        y <= pos.y + pos.height
    );

    if (clickedGoal) {
      onGoalClick?.(clickedGoal.goal);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Calculate new scale
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale * delta));

    // Adjust offset to zoom toward mouse position
    const yearAtMouse = xToYear(mouseX);
    const newOffsetX = mouseX - (yearAtMouse - birthYear) * YEAR_WIDTH * newScale;

    setState((prev) => ({
      ...prev,
      scale: newScale,
      offsetX: newOffsetX,
    }));
  };

  // Zoom controls
  const zoomIn = () => {
    setState((prev) => ({
      ...prev,
      scale: Math.min(MAX_SCALE, prev.scale * 1.2),
    }));
  };

  const zoomOut = () => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(MIN_SCALE, prev.scale / 1.2),
    }));
  };

  const resetView = () => {
    setState((prev) => ({
      ...prev,
      scale: 1,
      offsetX: 0,
    }));
  };

  const setZoomPreset = (preset: ZoomPreset) => {
    const { scale } = ZOOM_PRESETS[preset];
    // Center on current year when changing presets
    const centerX = dimensions.width / 2;
    const newOffsetX = centerX - (currentYear - birthYear) * YEAR_WIDTH * scale;
    setState((prev) => ({
      ...prev,
      scale,
      offsetX: newOffsetX,
    }));
  };

  // Determine active zoom preset
  const getActivePreset = (): ZoomPreset | null => {
    const epsilon = 0.05;
    for (const [preset, { scale }] of Object.entries(ZOOM_PRESETS)) {
      if (Math.abs(state.scale - scale) < epsilon) {
        return preset as ZoomPreset;
      }
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[400px] ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* Zoom preset buttons */}
        <div className="flex gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-1">
          {(Object.entries(ZOOM_PRESETS) as [ZoomPreset, { scale: number; label: string }][]).map(
            ([preset, { label }]) => (
              <button
                key={preset}
                onClick={() => setZoomPreset(preset)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  getActivePreset() === preset
                    ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                    : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                }`}
                aria-label={`Zoom to ${label} view`}
              >
                {label}
              </button>
            )
          )}
        </div>

        {/* Zoom in/out buttons */}
        <div className="flex flex-col gap-1">
          <button
            onClick={zoomIn}
            className="btn btn-secondary p-2"
            aria-label="Zoom in"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={zoomOut}
            className="btn btn-secondary p-2"
            aria-label="Zoom out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={resetView}
            className="btn btn-secondary p-2"
            aria-label="Reset view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Hover tooltip for events */}
      {hoveredEvent && (
        <div
          className="absolute bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg pointer-events-none z-10"
          style={{
            left: Math.min(
              eventPositions.find((p) => p.event.id === hoveredEvent.id)?.x ?? 0,
              dimensions.width - 200
            ),
            top:
              (eventPositions.find((p) => p.event.id === hoveredEvent.id)?.y ?? 0) +
              LANE_HEIGHT +
              8,
          }}
        >
          <div className="font-medium text-[var(--color-text-primary)]">
            {hoveredEvent.title}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            {new Date(hoveredEvent.startDate).toLocaleDateString()}
          </div>
          <div
            className="text-xs mt-1 capitalize"
            style={{ color: LAYER_COLORS[hoveredEvent.layer] }}
          >
            {hoveredEvent.layer}
          </div>
        </div>
      )}

      {/* Hover tooltip for goals */}
      {hoveredGoal && !hoveredEvent && (
        <div
          className="absolute bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg pointer-events-none z-10"
          style={{
            left: Math.min(
              goalPositions.find((p) => p.goal.id === hoveredGoal.id)?.x ?? 0,
              dimensions.width - 200
            ),
            top:
              (goalPositions.find((p) => p.goal.id === hoveredGoal.id)?.y ?? 0) +
              LANE_HEIGHT +
              8,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 text-xs bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] rounded">
              GOAL
            </span>
            <span className="text-xs text-[var(--color-text-muted)] capitalize">
              {hoveredGoal.priority} priority
            </span>
          </div>
          <div className="font-medium text-[var(--color-text-primary)]">
            {hoveredGoal.title}
          </div>
          {hoveredGoal.targetDate && (
            <div className="text-sm text-[var(--color-text-secondary)]">
              Target: {new Date(hoveredGoal.targetDate).toLocaleDateString()}
            </div>
          )}
          <div
            className="text-xs mt-1 capitalize"
            style={{ color: LAYER_COLORS[GOAL_CATEGORY_TO_LAYER[hoveredGoal.category] || 'media'] }}
          >
            {hoveredGoal.category}
          </div>
        </div>
      )}

      {/* Scale indicator */}
      <div className="absolute bottom-4 left-4 text-xs text-[var(--color-text-muted)]">
        Scale: {(state.scale * 100).toFixed(0)}%
      </div>
    </div>
  );
}

export default TimelineCanvas;
