import { useRef } from "react";

/**
 * A custom hook that returns the previous value of the provided value.
 * @param value The value to compare against the previous render.
 * @returns The previous value of the provided value.
 */
export function usePrevious<T>(value: T) {
  const ref = useRef<T>();
  const previousValue = ref.current;
  ref.current = value;
  return previousValue;
}
