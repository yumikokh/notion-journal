import { useEffect, useRef } from 'react';

type UseAutoSaveOptions = {
  /** Debounce delay in ms (default 1500). */
  delay?: number;
  /** Gate the save (e.g. only after the user has made a real edit). */
  enabled?: boolean;
};

/**
 * Calls `onSave(value)` after `delay` ms of `value` stability.
 * Skipped entirely when `enabled` is false.
 */
export function useAutoSave<T>(
  value: T,
  onSave: (value: T) => void,
  options: UseAutoSaveOptions = {},
) {
  const { delay = 1500, enabled = true } = options;
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => onSaveRef.current(value), delay);
    return () => clearTimeout(t);
  }, [value, delay, enabled]);
}
