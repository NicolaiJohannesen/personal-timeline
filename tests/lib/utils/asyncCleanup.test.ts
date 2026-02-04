import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAbortController,
  isAbortError,
  cancellableAsync,
  createSafeSetState,
  createDebouncedAsync,
  createThrottled,
  composeCleanup,
} from '@/lib/utils/asyncCleanup';

describe('Async Cleanup Utilities', () => {
  describe('createAbortController', () => {
    it('creates controller with signal and cleanup', () => {
      const { controller, signal, cleanup, isAborted } = createAbortController();

      expect(controller).toBeInstanceOf(AbortController);
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(typeof cleanup).toBe('function');
      expect(typeof isAborted).toBe('function');
    });

    it('isAborted returns false initially', () => {
      const { isAborted } = createAbortController();

      expect(isAborted()).toBe(false);
    });

    it('isAborted returns true after cleanup', () => {
      const { cleanup, isAborted } = createAbortController();

      cleanup();

      expect(isAborted()).toBe(true);
    });

    it('signal is aborted after cleanup', () => {
      const { signal, cleanup } = createAbortController();

      cleanup();

      expect(signal.aborted).toBe(true);
    });
  });

  describe('isAbortError', () => {
    it('returns true for AbortError', () => {
      const error = new DOMException('Aborted', 'AbortError');

      expect(isAbortError(error)).toBe(true);
    });

    it('returns true for error with Aborted message', () => {
      const error = new Error('Aborted');

      expect(isAbortError(error)).toBe(true);
    });

    it('returns false for other errors', () => {
      const error = new Error('Something went wrong');

      expect(isAbortError(error)).toBe(false);
    });

    it('returns false for non-errors', () => {
      expect(isAbortError('string error')).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError(undefined)).toBe(false);
    });
  });

  describe('cancellableAsync', () => {
    it('executes async function', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);

      cancellableAsync(fn);

      await vi.waitFor(() => expect(fn).toHaveBeenCalled());
    });

    it('passes signal to async function', async () => {
      let receivedSignal: AbortSignal | undefined;
      const fn = vi.fn().mockImplementation(async (signal: AbortSignal) => {
        receivedSignal = signal;
      });

      cancellableAsync(fn);

      await vi.waitFor(() => expect(receivedSignal).toBeInstanceOf(AbortSignal));
    });

    it('returns cancel function', () => {
      const fn = vi.fn().mockResolvedValue(undefined);

      const cancel = cancellableAsync(fn);

      expect(typeof cancel).toBe('function');
    });

    it('calls onError for non-abort errors', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      cancellableAsync(fn, onError);

      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    });

    it('does not call onError for abort errors', async () => {
      const error = new DOMException('Aborted', 'AbortError');
      const fn = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      cancellableAsync(fn, onError);

      // Wait a bit to ensure onError would have been called
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('createSafeSetState', () => {
    it('calls setState when not cancelled', () => {
      const setState = vi.fn();
      const safe = createSafeSetState(setState);

      safe.set('test value');

      expect(setState).toHaveBeenCalledWith('test value');
    });

    it('does not call setState after cancel', () => {
      const setState = vi.fn();
      const safe = createSafeSetState(setState);

      safe.cancel();
      safe.set('test value');

      expect(setState).not.toHaveBeenCalled();
    });

    it('supports functional updates', () => {
      const setState = vi.fn();
      const safe = createSafeSetState<number>(setState);

      const updater = (prev: number) => prev + 1;
      safe.set(updater);

      expect(setState).toHaveBeenCalledWith(updater);
    });
  });

  describe('createDebouncedAsync', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('delays function execution', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { call } = createDebouncedAsync(fn, 100);

      call('test');

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('test');
    });

    it('cancels pending execution', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { call, cancel } = createDebouncedAsync(fn, 100);

      call('test');
      cancel();

      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });

    it('only executes the last call', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { call } = createDebouncedAsync(fn, 100);

      call('first');
      call('second');
      call('third');

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('flush executes immediately', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { call, flush } = createDebouncedAsync(fn, 100);

      call('test');
      flush();

      expect(fn).toHaveBeenCalledWith('test');
    });
  });

  describe('createThrottled', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('executes first call immediately', () => {
      const fn = vi.fn();
      const { call } = createThrottled(fn, 100);

      call('test');

      expect(fn).toHaveBeenCalledWith('test');
    });

    it('throttles subsequent calls', () => {
      const fn = vi.fn();
      const { call } = createThrottled(fn, 100);

      call('first');
      call('second');
      call('third');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('allows calls after throttle period', () => {
      const fn = vi.fn();
      const { call } = createThrottled(fn, 100);

      call('first');
      vi.advanceTimersByTime(100);
      call('second');

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('cancel resets throttle state', () => {
      const fn = vi.fn();
      const { call, cancel } = createThrottled(fn, 100);

      call('first');
      cancel();
      call('second');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('composeCleanup', () => {
    it('calls all cleanup functions', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      const cleanup3 = vi.fn();

      const composed = composeCleanup(cleanup1, cleanup2, cleanup3);
      composed();

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
      expect(cleanup3).toHaveBeenCalled();
    });

    it('continues even if one cleanup throws', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn().mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      const cleanup3 = vi.fn();

      const composed = composeCleanup(cleanup1, cleanup2, cleanup3);
      composed();

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
      expect(cleanup3).toHaveBeenCalled();
    });

    it('returns a function', () => {
      const composed = composeCleanup();

      expect(typeof composed).toBe('function');
    });
  });
});
