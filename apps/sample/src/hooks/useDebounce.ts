import { useEffect, useState } from "react";

/**
 * A custom hook that debounces a value.
 * @param value The value to debounce.
 * @param delay The debounce delay in milliseconds.
 * @returns The debounced value, which updates only after the specified delay has passed without changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}
