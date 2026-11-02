import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import { type LogData } from "../types";
import { LogRow } from "./LogRow";
import { ScrollDownButton } from "./ScrollDownButton";
import { type ColumnSizing } from "./TableColumns";
import { useFollowBottom } from "./useFollowBottom";

// Like Dozzle, only a window of the newest logs is rendered; older ones are a click away
const WINDOW_STEP = 500;

// A key per log rather than per position, so rows keep their DOM and state when logs shift
const rowKeys = new WeakMap<LogData, number>();
let nextRowKey = 0;
const rowKey = (log: LogData) => {
  let key = rowKeys.get(log);
  if (key === undefined) {
    key = nextRowKey++;
    rowKeys.set(log, key);
  }
  return key;
};

type LogsTableProps = {
  data: Array<LogData>;
  highlightedIndices?: Set<number>;
  currentHighlightIndex?: number;
  scrollToIndex?: number;
  follow: boolean;
  newestFirst: boolean;
  columnSizing: ColumnSizing;
  /** Lets the column header, outside this scroll container, follow the rows sideways. */
  onHorizontalScroll: (scrollLeft: number) => void;
};

const LIST_BUTTON =
  "w-full cursor-pointer py-4 text-center font-mono! body-4 text-muted hover:bg-base-transparent-hover hover:text-base";

export const LogsTable: React.FC<LogsTableProps> = ({
  data,
  highlightedIndices,
  currentHighlightIndex,
  scrollToIndex,
  follow,
  newestFirst,
  columnSizing,
  onHorizontalScroll,
}) => {
  const [expandedLogs, setExpandedLogs] = useState<Set<LogData>>(new Set());
  const {
    containerRef,
    contentRef,
    onScroll,
    atBottom,
    setAtBottom,
    scrollToBottom,
  } = useFollowBottom(follow);

  // Opening a row means reading it: stop following, or the next log would scroll it away
  const toggleLog = useCallback(
    (log: LogData) => {
      setAtBottom(false);
      setExpandedLogs((previous) => {
        const next = new Set(previous);
        if (!next.delete(log)) next.add(log);
        return next;
      });
    },
    [setAtBottom],
  );

  // A remount starts scrolled to the left: so must the header
  useEffect(() => {
    onHorizontalScroll(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [windowSize, setWindowSize] = useState(WINDOW_STEP);
  // While the reader is scrolled up the rows on screen stay put: new logs are counted, not rendered
  const [pinned, setPinned] = useState<Set<LogData> | null>(null);

  // The log cap or a filter may remove some of the pinned rows: keep the span of those left
  const [pinnedStart, pinnedEnd] = useMemo(() => {
    let first = -1;
    let last = -1;
    if (pinned) {
      data.forEach((log, index) => {
        if (!pinned.has(log)) return;
        if (first < 0) first = index;
        last = index;
      });
    }
    return [first, last];
  }, [data, pinned]);
  const isPinned = pinnedStart >= 0;
  const [start, end] = isPinned
    ? [pinnedStart, pinnedEnd + 1]
    : newestFirst
      ? [0, Math.min(data.length, windowSize)]
      : [Math.max(0, data.length - windowSize), data.length];
  const rows = data.slice(start, end);
  const olderCount = newestFirst ? data.length - end : start;
  const newerCount = isPinned ? data.length - end : 0;

  // Pin what is on screen when the reader leaves the bottom, not on every new log
  useEffect(() => {
    if (atBottom) {
      setPinned(null);
    } else if (follow && !newestFirst && rows.length > 0) {
      setPinned((previous) => previous ?? new Set(rows));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atBottom]);

  const showOlder = () => {
    const container = containerRef.current;
    // Browsers do not anchor the scroll position at the very top, so keep it by hand
    const fromBottom = container
      ? container.scrollHeight - container.scrollTop
      : 0;
    flushSync(() => {
      if (isPinned) {
        setPinned(new Set(data.slice(Math.max(0, start - WINDOW_STEP), end)));
      } else {
        setWindowSize((size) => size + WINDOW_STEP);
      }
    });
    if (container && !newestFirst) {
      container.scrollTop = container.scrollHeight - fromBottom;
    }
  };

  // Newest first puts the latest logs at the top
  const [atTop, setAtTop] = useState(true);
  const atLatest = newestFirst ? atTop : atBottom;
  const handleScroll = () => {
    onScroll();
    const container = containerRef.current;
    if (!container) return;
    setAtTop(container.scrollTop <= 4);
    onHorizontalScroll(container.scrollLeft);
  };

  const jumpToLatest = () => {
    if (newestFirst) {
      if (containerRef.current) containerRef.current.scrollTop = 0;
      return;
    }
    flushSync(() => {
      setPinned(null);
      setAtBottom(true);
    });
    scrollToBottom();
  };

  // Bring the current search match into the window, then into view once
  useEffect(() => {
    if (scrollToIndex === undefined || scrollToIndex < 0) return;
    if (scrollToIndex >= start && scrollToIndex < end) return;
    if (newestFirst) {
      setWindowSize(scrollToIndex + 1);
    } else {
      setPinned(
        new Set(
          data.slice(
            Math.max(0, scrollToIndex - WINDOW_STEP / 2),
            scrollToIndex + WINDOW_STEP / 2 + 1,
          ),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToIndex]);

  // The log, not its index: new logs shift indices without moving the match
  const scrolledToLogRef = useRef<LogData | undefined>(undefined);
  useLayoutEffect(() => {
    if (scrollToIndex === undefined || scrollToIndex < 0) {
      // Forget the last match, so finding it again scrolls to it again
      scrolledToLogRef.current = undefined;
      return;
    }
    if (scrolledToLogRef.current === data[scrollToIndex]) return;
    const row = contentRef.current?.querySelector(
      `[data-index="${scrollToIndex}"]`,
    );
    if (!row) return;
    scrolledToLogRef.current = data[scrollToIndex];
    setAtBottom(false);
    row.scrollIntoView({ block: "center" });
  });

  const olderButton = olderCount > 0 && (
    <button type="button" className={LIST_BUTTON} onClick={showOlder}>
      Show {Math.min(olderCount, WINDOW_STEP)} older{" "}
      {olderCount === 1 ? "log" : "logs"}
      {olderCount > WINDOW_STEP && ` of ${olderCount}`}
    </button>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div ref={contentRef} className="w-full min-w-fit">
          {data.length === 0 ? (
            <p className="p-24 text-center body-2 text-muted">
              No logs to display
            </p>
          ) : (
            <>
              {!newestFirst && olderButton}
              {rows.map((log, offset) => (
                <LogRow
                  key={rowKey(log)}
                  log={log}
                  index={start + offset}
                  highlighted={highlightedIndices?.has(start + offset) ?? false}
                  currentMatch={currentHighlightIndex === start + offset}
                  expanded={expandedLogs.has(log)}
                  onToggle={toggleLog}
                  columnSizing={columnSizing}
                />
              ))}
              {newestFirst && olderButton}
              {newerCount > 0 && (
                <button
                  type="button"
                  className={LIST_BUTTON}
                  onClick={jumpToLatest}
                >
                  {newerCount} newer {newerCount === 1 ? "log" : "logs"}
                </button>
              )}
              {follow && (
                // Hidden rather than removed: a height change here would move the reader back to the bottom
                <div
                  className={`flex h-24 items-center justify-center gap-4 ${atBottom ? "" : "invisible"}`}
                  role="status"
                  aria-label={atBottom ? "Following new logs" : undefined}
                >
                  {[
                    "",
                    "[animation-delay:200ms]",
                    "[animation-delay:400ms]",
                  ].map((delay) => (
                    <span
                      key={delay}
                      className={`size-4 animate-pulse rounded-full bg-muted-strong ${delay}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <ScrollDownButton
        enabled={atLatest}
        onClick={jumpToLatest}
        up={newestFirst}
      />
    </div>
  );
};
