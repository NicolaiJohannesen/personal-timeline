/**
 * Async cleanup utilities for React components
 * Prevents memory leaks and state updates on unmounted components
 */

/**
 * Creates an abort controller with cleanup function for useEffect
 * @returns Object with signal and cleanup function
 *
 * @example
 * useEffect(() => {
 *   const { signal, cleanup } = createAbortController();
 *
 *   async function loadData() {
 *     try {
 *       const data = await fetchData({ signal });
 *       if (!signal.aborted) {
 *         setData(data);
 *       }
 *     } catch (err) {
 *       if (!isAbortError(err)) {
 *         setError(err);
 *       }
 *     }
 *   }
 *
 *   loadData();
 *   return cleanup;
 * }, []);
 */
export function createAbortController(): {
  controller: AbortController;
  signal: AbortSignal;
  cleanup: () => void;
  isAborted: () => boolean;
} {
  const controller = new AbortController();

  return {
    controller,
    signal: controller.signal,
    cleanup: () => controller.abort(),
    isAborted: () => controller.signal.aborted,
  };
}

/**
 * Check if an error is an abort error
 * Handles both native Error and DOMException (which may not extend Error in some environments)
 */
export function isAbortError(error: unknown): boolean {
  if (error == null) return false;

  // Check for DOMException with AbortError name (e.g., from fetch abort)
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  // Check for regular Error with AbortError name or 'Aborted' message
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message === 'Aborted';
  }

  // Check for error-like objects with name property
  if (typeof error === 'object' && 'name' in error) {
    return (error as { name: unknown }).name === 'AbortError';
  }

  return false;
}

/**
 * Wraps an async operation to make it cancellable
 * Returns a function that when called, cancels the operation
 *
 * @example
 * useEffect(() => {
 *   const cancel = cancellableAsync(
 *     async (signal) => {
 *       const data = await fetchData({ signal });
 *       setData(data);
 *     },
 *     (error) => setError(error)
 *   );
 *   return cancel;
 * }, []);
 */
export function cancellableAsync(
  asyncFn: (signal: AbortSignal) => Promise<void>,
  onError?: (error: Error) => void
): () => void {
  const controller = new AbortController();
  const { signal } = controller;

  asyncFn(signal).catch((error) => {
    if (!isAbortError(error) && onError) {
      onError(error as Error);
    }
  });

  return () => controller.abort();
}

/**
 * Safe setState wrapper that checks if component is still mounted
 *
 * @example
 * const [data, setData] = useState(null);
 * const safeSetData = useSafeState(setData);
 *
 * useEffect(() => {
 *   fetchData().then(safeSetData);
 *   return () => safeSetData.cancel();
 * }, []);
 */
export function createSafeSetState<T>(
  setState: React.Dispatch<React.SetStateAction<T>>
): {
  set: (value: T | ((prev: T) => T)) => void;
  cancel: () => void;
} {
  let isCancelled = false;

  return {
    set: (value: T | ((prev: T) => T)) => {
      if (!isCancelled) {
        setState(value);
      }
    },
    cancel: () => {
      isCancelled = true;
    },
  };
}

/**
 * Creates a debounced async function with cleanup
 */
export function createDebouncedAsync<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  delay: number
): {
  call: (...args: T) => void;
  cancel: () => void;
  flush: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: T | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingArgs = null;
  };

  const flush = () => {
    if (timeoutId !== null && pendingArgs !== null) {
      clearTimeout(timeoutId);
      fn(...pendingArgs);
      timeoutId = null;
      pendingArgs = null;
    }
  };

  const call = (...args: T) => {
    cancel();
    pendingArgs = args;
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
      pendingArgs = null;
    }, delay);
  };

  return { call, cancel, flush };
}

/**
 * Creates a throttled function with cleanup
 */
export function createThrottled<T extends unknown[]>(
  fn: (...args: T) => void,
  limit: number
): {
  call: (...args: T) => void;
  cancel: () => void;
} {
  let inThrottle = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
  };

  const call = (...args: T) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      timeoutId = setTimeout(() => {
        inThrottle = false;
        timeoutId = null;
      }, limit);
    }
  };

  return { call, cancel };
}

/**
 * Utility to run cleanup functions in order
 */
export function composeCleanup(...cleanupFns: (() => void)[]): () => void {
  return () => {
    for (const cleanup of cleanupFns) {
      try {
        cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  };
}
