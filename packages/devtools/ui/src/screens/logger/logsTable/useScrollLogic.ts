import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

import { SCROLL_THRESHOLD } from "./constants";
import { useResizeObserver } from "./useResizeObserver";

export const useScrollLogic = ({
  data,
  follow,
}: {
  data: unknown[];
  follow: boolean;
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const isScrollingProgrammaticallyRef = React.useRef(false);
  const prevDataLengthRef = React.useRef(data.length);
  const lastScrollTopRef = React.useRef(0);
  const isDraggingScrollbarRef = React.useRef(false);
  // Mirrors autoScrollEnabled without waiting for a render, so a scroll up stops following at once
  const followingRef = React.useRef(true);
  const setFollowing = useCallback((following: boolean) => {
    followingRef.current = following;
    setAutoScrollEnabled(following);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      isScrollingProgrammaticallyRef.current = true;
      setFollowing(true);
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
  }, [setFollowing]);

  // Eases new logs into view; a jump longer than the viewport stays instant.
  const followBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !follow || !followingRef.current) return;
    const distance =
      container.scrollHeight - container.clientHeight - container.scrollTop;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: distance > container.clientHeight ? "instant" : "smooth",
    });
  }, [follow]);

  // Auto-scroll when new data arrives (not on container resize)
  useEffect(() => {
    if (autoScrollEnabled && scrollContainerRef.current) {
      // Use double requestAnimationFrame to ensure DOM has updated and virtualizer has recalculated
      // This is necessary when content starts overflowing as the virtualizer needs time to measure
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current && autoScrollEnabled) {
            followBottom();
          }
        });
      });
    }
  }, [data.length, autoScrollEnabled, followBottom]);

  // Reset scroll position when data shrinks significantly (e.g., filter applied)
  // This prevents the virtualizer from being in an invalid scroll state
  useEffect(() => {
    const prevLength = prevDataLengthRef.current;
    const currentLength = data.length;
    prevDataLengthRef.current = currentLength;

    // If data shrunk significantly (more than 50% reduction or to near-empty)
    if (currentLength < prevLength * 0.5 || currentLength <= 3) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
      setFollowing(true);
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

    const scrollTop = container.scrollTop;
    const movedUp = scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // Only update autoScrollEnabled for manual user scrolls
    if (isScrollingProgrammaticallyRef.current) {
      return;
    }

    const isNearBottom =
      scrollTop + container.clientHeight >=
      container.scrollHeight - SCROLL_THRESHOLD;

    // The virtualizer also nudges scrollTop up while measuring rows, so only a scrollbar drag counts here
    if (isNearBottom) {
      setFollowing(true);
    } else if (movedUp && isDraggingScrollbarRef.current) {
      setFollowing(false);
    }
  }, [setFollowing]);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (event.deltaY < 0) setFollowing(false);
    },
    [setFollowing],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
        setFollowing(false);
      }
    },
    [setFollowing],
  );

  const onPointerDown = useCallback(() => {
    isDraggingScrollbarRef.current = true;
    window.addEventListener(
      "pointerup",
      () => {
        isDraggingScrollbarRef.current = false;
      },
      { once: true },
    );
  }, []);

  return {
    autoScrollEnabled,
    onScroll,
    onWheel,
    onKeyDown,
    onPointerDown,
    scrollContainerRef,
    scrollZoneHeight,
    scrollToBottom,
    followBottom,
    scrollZoneRef,
  };
};
