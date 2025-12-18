import { useLayoutEffect, useRef } from "react";

export function useResizeObserver<T extends HTMLElement>(
  callback: (target: T, entry: ResizeObserverEntry) => void,
) {
  const ref = useRef<T>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useLayoutEffect(() => {
    const element = ref?.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        callbackRef.current(element, entry);
      }
    });

    // Observe border box to catch all size changes including padding/borders
    observer.observe(element, { box: "border-box" });

    return () => {
      observer.disconnect();
    };
  }, []); // Empty dependency array - observer is created once

  return ref;
}
