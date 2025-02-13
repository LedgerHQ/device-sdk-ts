import { useRef } from "react";

/**
 * A custom hook that returns whether the value has changed since the last render.
 * @param value The value to compare against the previous render.
 * @returns A boolean indicating whether the value has changed since the last render.
 */
export function useHasChanged<T>(value: T): boolean {
  const ref = useRef<T>(value);
  const hasChanged = ref.current !== value;
  ref.current = value;
  return hasChanged;
}
