import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineCanvas } from '@/components/client/TimelineCanvas';
import type { TimelineEvent } from '@/types';

// Mock canvas methods
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    roundRect: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const createTestEvent = (overrides?: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'test-id-1',
  userId: 'test-user',
  title: 'Test Event',
  startDate: new Date('2020-06-15'),
  layer: 'work',
  eventType: 'job',
  source: 'manual',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TimelineCanvas', () => {
  it('renders zoom controls', () => {
    render(<TimelineCanvas events={[]} birthYear={1992} />);

    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument();
  });

  it('displays scale indicator at 100%', () => {
    render(<TimelineCanvas events={[]} birthYear={1992} />);
    expect(screen.getByText(/Scale: 100%/i)).toBeInTheDocument();
  });

  it('increases scale when zoom in is clicked', () => {
    render(<TimelineCanvas events={[]} birthYear={1992} />);

    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(screen.getByText(/Scale: 120%/i)).toBeInTheDocument();
  });

  it('decreases scale when zoom out is clicked', () => {
    render(<TimelineCanvas events={[]} birthYear={1992} />);

    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(screen.getByText(/Scale: 83%/i)).toBeInTheDocument();
  });

  it('resets scale when reset view is clicked', () => {
    render(<TimelineCanvas events={[]} birthYear={1992} />);

    // Zoom in twice
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

    // Reset
    fireEvent.click(screen.getByRole('button', { name: /reset view/i }));
    expect(screen.getByText(/Scale: 100%/i)).toBeInTheDocument();
  });

  it('renders canvas element', () => {
    render(<TimelineCanvas events={[]} birthYear={1992} />);
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <TimelineCanvas events={[]} birthYear={1992} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders with events', () => {
    const events = [createTestEvent()];
    render(<TimelineCanvas events={events} birthYear={1992} />);
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('calls onEventHover with null on mouse leave', () => {
    const onEventHover = vi.fn();
    render(
      <TimelineCanvas events={[]} birthYear={1992} onEventHover={onEventHover} />
    );

    fireEvent.mouseLeave(document.querySelector('canvas')!);
    expect(onEventHover).toHaveBeenCalledWith(null);
  });

  it('handles mouse interactions', () => {
    render(<TimelineCanvas events={[]} birthYear={1992} />);
    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 100 });
    fireEvent.mouseMove(canvas, { clientX: 200 });
    fireEvent.mouseUp(canvas);

    // No errors thrown
    expect(canvas).toBeInTheDocument();
  });
});
