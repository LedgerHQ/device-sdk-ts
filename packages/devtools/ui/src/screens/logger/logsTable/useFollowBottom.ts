import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// Small, so the first pixels of a slow scroll up already stop the following
const BOTTOM_THRESHOLD = 4;

/**
 * Follows new logs the way Dozzle does: while the reader is at the bottom, any
 * change to the list scrolls it back there.
 */
export const useFollowBottom = (follow: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottomState] = useState(true);
  // Read by the mutation observer, which runs before React re-renders
  const atBottomRef = useRef(true);
  const setAtBottom = useCallback((value: boolean) => {
    atBottomRef.current = value;
    setAtBottomState(value);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (follow) scrollToBottom();
  }, [follow, scrollToBottom]);

  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distance =
      container.scrollHeight - container.clientHeight - container.scrollTop;
    const value = distance <= BOTTOM_THRESHOLD;
    if (value !== atBottomRef.current) setAtBottom(value);
  }, [setAtBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !follow) return;
    const observer = new MutationObserver(() => {
      if (atBottomRef.current) scrollToBottom();
    });
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [follow, scrollToBottom]);

  return {
    containerRef,
    contentRef,
    onScroll,
    atBottom,
    setAtBottom,
    scrollToBottom,
  };
};
