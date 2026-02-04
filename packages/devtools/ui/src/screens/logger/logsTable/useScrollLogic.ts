import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

import { SCROLL_THRESHOLD } from "./constants";
import { useResizeObserver } from "./useResizeObserver";

export const useScrollLogic = ({ data }: { data: unknown[] }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const isScrollingProgrammaticallyRef = React.useRef(false);
  const prevDataLengthRef = React.useRef(data.length);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      isScrollingProgrammaticallyRef.current = true;
      setAutoScrollEnabled(true);
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "instant",
      });
      // Reset the flag after a brief delay to allow scroll to complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isScrollingProgrammaticallyRef.current = false;
        });
      });
    }
  }, []);

  // Auto-scroll when new data arrives (not on container resize)
  useEffect(() => {
    if (autoScrollEnabled && scrollContainerRef.current) {
      // Use double requestAnimationFrame to ensure DOM has updated and virtualizer has recalculated
      // This is necessary when content starts overflowing as the virtualizer needs time to measure
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current && autoScrollEnabled) {
            scrollToBottom();
          }
        });
      });
    }
  }, [data.length, autoScrollEnabled, scrollToBottom]);

  // Reset scroll position when data shrinks significantly (e.g., filter applied)
  // This prevents the virtualizer from being in an invalid scroll state
  useEffect(() => {
    const prevLength = prevDataLengthRef.current;
    const currentLength = data.length;
    prevDataLengthRef.current = currentLength;

    // If data shrunk significantly (more than 50% reduction or to near-empty)
    if (currentLength < prevLength * 0.5 || currentLength <= 3) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
      setAutoScrollEnabled(true);
    }
  }, [data.length]);

  const [scrollZoneHeight, setScrollZoneHeight] = useState(0);
  const updateScrollZoneHeight = useCallback(
    (_: HTMLDivElement, entry: ResizeObserverEntry) => {
      setScrollZoneHeight(entry.contentRect.height);
    },
    [],
  );
  const scrollZoneRef = useResizeObserver<HTMLDivElement>(
    updateScrollZoneHeight,
  );

  // Calculate initial height on mount
  useLayoutEffect(() => {
    if (scrollZoneRef.current) {
      const height = scrollZoneRef.current.getBoundingClientRect().height;
      if (height > 0) {
        setScrollZoneHeight(height);
      }
    }
  }, [scrollZoneRef]);

  const onScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only update autoScrollEnabled for manual user scrolls
    if (isScrollingProgrammaticallyRef.current) {
      return;
    }

    const isNearBottom =
      container.scrollTop + container.clientHeight >=
      container.scrollHeight - SCROLL_THRESHOLD;

    setAutoScrollEnabled(isNearBottom);
  }, []);

  return {
    autoScrollEnabled,
    onScroll,
    scrollContainerRef,
    scrollZoneHeight,
    scrollToBottom,
    scrollZoneRef,
  };
};
