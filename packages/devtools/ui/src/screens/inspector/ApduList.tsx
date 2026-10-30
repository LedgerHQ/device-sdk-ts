import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconButton, Tag } from "@ledgerhq/lumen-ui-react";
import {
  ChevronRight,
  Download,
  Trash,
} from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../components/WithTooltip";
import { parseFilterQuery } from "../logger/filterUtils";
import { INPUT, INPUT_CONTAINER, INPUT_WRAPPER } from "../logger/inputStyles";
import { ScrollDownButton } from "../logger/logsTable/ScrollDownButton";
import { PauseButton } from "../logger/PauseButton";
import { type ApduExchange, OS_LAYER, statusName } from "./apduExchanges";
import { matchesText } from "./apduFilter";
import { CopyButton } from "./CopyButton";
import { useScrollLogic } from "./useScrollLogic";

const HEADER_BYTES = 5;

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });

const statusTone = (statusWord: string) => {
  if (statusWord === "9000") {
    return { bar: "bg-(--color-light-green-500)", text: "text-success" };
  }
  if (statusWord === "5515") {
    return { bar: "bg-(--color-light-yellow-500)", text: "text-warning" };
  }
  return { bar: "bg-(--color-light-red-500)", text: "text-error" };
};

const searchableText = (exchange: ApduExchange) =>
  [
    exchange.command,
    exchange.layer,
    exchange.sent.join(" "),
    exchange.sent.join(""),
    exchange.received.join(" "),
    exchange.received.join(""),
    statusName(exchange.statusWord),
  ].join(" ");

type ApduRowProps = {
  exchange: ApduExchange;
  open: boolean;
  onToggle: (id: string) => void;
};

const ApduRowContent: React.FC<ApduRowProps> = ({
  exchange,
  open,
  onToggle,
}) => {
  const tone = statusTone(exchange.statusWord);
  return (
    <div className="flex gap-8 px-8 py-2">
      <span className={`w-4 shrink-0 rounded-full ${tone.bar}`} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onToggle(exchange.id)}
          className="flex w-full cursor-pointer items-center gap-12 rounded-xs px-8 py-2 text-left font-mono! body-3 text-base hover:bg-base-transparent-hover"
        >
          <ChevronRight
            size={12}
            className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="text-muted">{formatTime(exchange.timestamp)}</span>
          <span className="flex min-w-0 flex-1 items-center gap-8">
            <Tag
              size="sm"
              appearance={
                exchange.layer === OS_LAYER ? "accent-subtle" : "gray"
              }
              label={exchange.layer ?? "Unknown"}
              className="max-w-128 shrink-0"
            />
            <span className="truncate">{exchange.command}</span>
          </span>
          <span className="body-4 whitespace-nowrap text-muted">
            {exchange.sent.length} B → {exchange.received.length} B
          </span>
          <span className={`w-128 truncate ${tone.text}`}>
            {exchange.statusWord} {statusName(exchange.statusWord)}
          </span>
        </button>
        {open && (
          <div className="my-4 flex flex-col gap-8 rounded-sm bg-muted px-12 py-8 font-mono! body-3">
            <div className="flex items-center gap-8">
              <span className="body-4-semi-bold text-muted uppercase">
                Sent · {exchange.sent.length} B
              </span>
              <span className="flex-1" />
              <CopyButton
                text={exchange.sent.join("")}
                label="Copy sent bytes"
              />
            </div>
            <p className="break-all">
              {exchange.sent.slice(0, HEADER_BYTES).join(" ")}{" "}
              <span className="text-muted">
                {exchange.sent.slice(HEADER_BYTES).join(" ")}
              </span>
            </p>
            <div className="flex items-center gap-8">
              <span className="body-4-semi-bold text-muted uppercase">
                Received · {exchange.received.length} B
              </span>
              <span className="flex-1" />
              <CopyButton
                text={exchange.received.join("")}
                label="Copy received bytes"
              />
            </div>
            <p className="break-all">{exchange.received.join(" ")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Exchanges are rebuilt from the logs on every new log, but one id always holds the same bytes
const ApduRow = React.memo(
  ApduRowContent,
  (previous, next) =>
    previous.exchange.id === next.exchange.id &&
    previous.open === next.open &&
    previous.onToggle === next.onToggle,
);

export const ApduList: React.FC<{ exchanges: ApduExchange[] }> = ({
  exchanges,
}) => {
  const [filterText, setFilterText] = useState("");
  const [pausedExchanges, setPausedExchanges] = useState<ApduExchange[] | null>(
    null,
  );
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const sourceExchanges = useMemo(() => {
    const source = pausedExchanges ?? exchanges;
    return clearedAt === null
      ? source
      : source.filter((exchange) => exchange.timestamp > clearedAt);
  }, [pausedExchanges, exchanges, clearedAt]);

  const visibleExchanges = useMemo(() => {
    const tokens = parseFilterQuery(filterText);
    return sourceExchanges.filter((exchange) =>
      matchesText(searchableText(exchange), tokens),
    );
  }, [sourceExchanges, filterText]);

  const toggle = useCallback((id: string) => {
    setOpenIds((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const clear = () => {
    setClearedAt(exchanges.at(-1)?.timestamp ?? null);
    setPausedExchanges((previous) => previous && []);
  };

  const exportExchanges = () => {
    const blob = new Blob([JSON.stringify(visibleExchanges, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apdu-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paused = pausedExchanges !== null;
  const {
    autoScrollEnabled,
    onScroll,
    onWheel,
    onKeyDown,
    onPointerDown,
    scrollContainerRef,
    scrollToBottom,
    followBottom,
  } = useScrollLogic({ data: visibleExchanges, follow: !paused });

  // Opening a payload or a new exchange grows the content after the scroll
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !autoScrollEnabled) return;
    const observer = new ResizeObserver(() => followBottom());
    observer.observe(content);
    return () => observer.disconnect();
  }, [autoScrollEnabled, followBottom]);

  const hiddenCount = sourceExchanges.length - visibleExchanges.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div className="flex items-center gap-12">
        <div className={INPUT_CONTAINER}>
          <div className={INPUT_WRAPPER}>
            <input
              className={INPUT}
              type="text"
              placeholder="Filter"
              aria-label="Filter APDUs"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>
        <span className="flex-1" />
        <span className="font-mono! body-4 whitespace-nowrap text-muted">
          {paused && <span className="text-warning">paused · </span>}
          {sourceExchanges.length}{" "}
          {sourceExchanges.length === 1 ? "exchange" : "exchanges"}
          {hiddenCount > 0 && ` · ${hiddenCount} filtered out`}
        </span>
        <div className="flex gap-6">
          <PauseButton
            paused={paused}
            onToggle={() => setPausedExchanges(paused ? null : exchanges)}
          />
          <WithTooltip label="Clear APDUs" side="bottom">
            <IconButton
              aria-label="Clear APDUs"
              icon={Trash}
              size="xs"
              appearance="transparent"
              className="rounded-sm"
              onClick={clear}
            />
          </WithTooltip>
          <WithTooltip label="Export APDUs" side="bottom">
            <IconButton
              aria-label="Export APDUs"
              icon={Download}
              size="xs"
              appearance="transparent"
              className="rounded-sm"
              onClick={exportExchanges}
            />
          </WithTooltip>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto"
          onScroll={onScroll}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
        >
          <div ref={contentRef}>
            {visibleExchanges.length === 0 ? (
              <p className="p-24 text-center body-2 text-muted">
                No APDU exchanged yet
              </p>
            ) : (
              visibleExchanges.map((exchange) => (
                <ApduRow
                  key={exchange.id}
                  exchange={exchange}
                  open={openIds.has(exchange.id)}
                  onToggle={toggle}
                />
              ))
            )}
            {autoScrollEnabled && !paused && visibleExchanges.length > 0 && (
              <div
                className="flex h-24 items-center justify-center gap-4"
                aria-label="Following new APDUs"
              >
                {["", "[animation-delay:200ms]", "[animation-delay:400ms]"].map(
                  (delay) => (
                    <span
                      key={delay}
                      className={`size-4 animate-pulse rounded-full bg-muted-strong ${delay}`}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
        <ScrollDownButton
          enabled={autoScrollEnabled}
          onClick={scrollToBottom}
        />
      </div>
    </div>
  );
};
