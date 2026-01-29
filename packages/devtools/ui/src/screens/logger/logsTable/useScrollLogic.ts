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
  const [scrollHeight, setScrollHeight] = useState(0);
  const scrollHeightRef = React.useRef(0);

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

  // Track scrollHeight changes to auto-scroll when content height changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScrollHeight = () => {
      const newScrollHeight = container.scrollHeight;
      if (newScrollHeight !== scrollHeightRef.current) {
        scrollHeightRef.current = newScrollHeight;
        setScrollHeight(newScrollHeight);
      }
    };

    // Initial check
    checkScrollHeight();

    // Use ResizeObserver on the container to detect size changes
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(checkScrollHeight);
    });

    resizeObserver.observe(container);

    // Also observe the scrollable content for changes
    const contentObserver = new MutationObserver(() => {
      requestAnimationFrame(checkScrollHeight);
    });

    if (container.firstElementChild) {
      contentObserver.observe(container.firstElementChild, {
        childList: true,
        subtree: true,
      });
    }

    // Periodic check as a fallback (less frequent to avoid performance issues)
    const interval = setInterval(() => {
      requestAnimationFrame(checkScrollHeight);
    }, 200);

    return () => {
      resizeObserver.disconnect();
      contentObserver.disconnect();
      clearInterval(interval);
    };
  }, []);

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
  }, [data.length, scrollHeight, autoScrollEnabled, scrollToBottom]);

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
