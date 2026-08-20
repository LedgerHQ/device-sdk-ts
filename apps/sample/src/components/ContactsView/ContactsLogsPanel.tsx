"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelector } from "react-redux";
import { LogLevel } from "@ledgerhq/device-management-kit";
import { Button, Flex, Icons, Input, Tag, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import {
  type ContactsLogEntry,
  useContactsLogEntries,
  useContactsLogsController,
} from "@/providers/ContactsLogs/ContactsLogsContext";
import {
  selectOrderedConnectedDevices,
  selectSelectedSessionId,
} from "@/state/sessions/selectors";

type FilterKind = "all" | "apdu" | "command" | "task" | "form";

const FILTER_CHIPS: ReadonlyArray<{ id: FilterKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "apdu", label: "APDU" },
  { id: "command", label: "Command" },
  { id: "task", label: "Task" },
  { id: "form", label: "Form" },
];

const COMMAND_TAGS: ReadonlySet<string> = new Set([
  "provideContact",
  "provideLedgerAccount",
  "editContactName",
  "editScope",
]);

function classifyTag(tag: string): FilterKind {
  if (tag === "device-session") return "apdu";
  if (COMMAND_TAGS.has(tag)) return "command";
  if (tag === "contacts-form") return "form";
  // SendXxxTask, ContactsContextLoader, etc.
  return "task";
}

function levelLabel(level: LogLevel): string {
  return LogLevel[level] ?? String(level);
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

// Stable JSON-replacer that flattens Uint8Array values into a hex string —
// the device-session entries carry raw bytes inside their `data` field via
// the APDU log formatters in DMK. Mirrors the WebLogsExporterLogger replacer.
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return (
      "0x" +
      Array.from(value)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  return value;
}

function entryToPlain(entry: ContactsLogEntry) {
  return {
    id: entry.id,
    ts: new Date(entry.ts).toISOString(),
    level: levelLabel(entry.level),
    tag: entry.tag,
    message: entry.message,
    data: entry.data,
  };
}

// Rendered as a normal block sibling inside PageContainer's flex column so
// it occupies real layout space at the bottom of the content area — never
// overlapping the sidebar. PageWithHeader's Root keeps flex:1 and shrinks
// to leave room for the panel; its inner overflow:auto handles the squeeze.
const PanelWrapper = styled.div<{ $open: boolean }>`
  flex: 0 0 auto;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
  border-top: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  display: flex;
  flex-direction: column;
  max-height: ${({ $open }) => ($open ? "320px" : "44px")};
  overflow: hidden;
  transition: max-height 0.2s ease;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.18);
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  cursor: pointer;
  user-select: none;
  gap: 12px;
  flex-wrap: wrap;
`;

const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

const PanelToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  flex-wrap: wrap;
`;

const PanelList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.55;
  min-height: 0;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 90px 70px 180px 1fr;
  column-gap: 12px;
  align-items: start;
  padding: 2px 0;
  cursor: pointer;
  border-bottom: 1px dashed transparent;
  &:hover {
    background-color: ${({ theme }) => theme.colors.opacityDefault.c05};
  }
`;

const Cell = styled.span`
  word-break: break-all;
  white-space: pre-wrap;
`;

const LevelCell = styled(Cell)<{ $level: LogLevel }>`
  color: ${({ theme, $level }) => {
    switch ($level) {
      case LogLevel.Fatal:
      case LogLevel.Error:
        return theme.colors.error.c60;
      case LogLevel.Warning:
        return theme.colors.warning.c60;
      case LogLevel.Info:
        return theme.colors.primary.c80;
      case LogLevel.Debug:
      default:
        return theme.colors.opacityDefault.c60;
    }
  }};
  font-weight: 600;
`;

const DataBlock = styled.pre`
  margin: 4px 0 4px 102px;
  padding: 6px 10px;
  background-color: ${({ theme }) => theme.colors.neutral.c30};
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11px;
`;

const EmptyHint = styled.div`
  color: ${({ theme }) => theme.colors.opacityDefault.c50};
  font-size: 12px;
  padding: 12px 0;
`;

function useExportPayload(entries: readonly ContactsLogEntry[]) {
  const selectedSessionId = useSelector(selectSelectedSessionId);
  const connected = useSelector(selectOrderedConnectedDevices);
  return useCallback(() => {
    const session =
      selectedSessionId &&
      connected.find((c) => c.sessionId === selectedSessionId);
    const header = {
      capturedAt: new Date().toISOString(),
      session: session
        ? {
            sessionId: session.sessionId,
            transport: session.connectedDevice.transport,
            modelId: session.connectedDevice.modelId,
            deviceName: session.connectedDevice.name,
            deviceId: session.connectedDevice.id,
          }
        : null,
      activeSessions: connected.map((c) => ({
        sessionId: c.sessionId,
        modelId: c.connectedDevice.modelId,
      })),
    };
    return JSON.stringify(
      {
        ...header,
        entries: entries.map(entryToPlain),
      },
      jsonReplacer,
      2,
    );
  }, [entries, selectedSessionId, connected]);
}

export const ContactsLogsPanel: React.FC = () => {
  const entries = useContactsLogEntries();
  const { clear, setPaused, isPaused } = useContactsLogsController();
  const [open, setOpen] = useState(false);
  const [paused, setPausedState] = useState(isPaused());
  const [filter, setFilter] = useState<FilterKind>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);
  const buildExport = useExportPayload(entries);

  const visible = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== "all" && classifyTag(entry.tag) !== filter) return false;
      if (!trimmedQuery) return true;
      const haystack = `${entry.tag} ${entry.message} ${
        entry.data ? JSON.stringify(entry.data, jsonReplacer) : ""
      }`.toLowerCase();
      return haystack.includes(trimmedQuery);
    });
  }, [entries, filter, query]);

  // Auto-scroll to newest unless the user has scrolled up.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible, open]);

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    setPausedState(next);
  }, [paused, setPaused]);

  const handleCopy = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(buildExport());
    } catch {
      // clipboard refusal — silently ignored; the user can fall back to download
    }
  }, [buildExport]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([buildExport()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildExport]);

  const toggleExpand = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <PanelWrapper $open={open}>
      <PanelHeader onClick={() => setOpen((v) => !v)}>
        <Flex alignItems="center" columnGap={2}>
          <Icons.Code size="S" />
          <Text variant="body" fontWeight="medium">
            Contacts APDU log
          </Text>
          <Text variant="small" color="opacityDefault.c50">
            ({entries.length}
            {paused ? " — paused" : ""})
          </Text>
        </Flex>
        <Flex alignItems="center" columnGap={1}>
          {open ? <Icons.ChevronDown size="S" /> : <Icons.ChevronUp size="S" />}
        </Flex>
      </PanelHeader>
      {open && (
        <PanelBody>
          <PanelToolbar onClick={(e) => e.stopPropagation()}>
            {FILTER_CHIPS.map((chip) => (
              <Tag
                key={chip.id}
                type={filter === chip.id ? "plain" : "outlinedOpacity"}
                active={filter === chip.id}
                onClick={() => setFilter(chip.id)}
                style={{ cursor: "pointer" }}
              >
                {chip.label}
              </Tag>
            ))}
            <Flex flex={1} minWidth="160px">
              <Input
                value={query}
                onChange={setQuery}
                placeholder="Filter tag / message / data"
              />
            </Flex>
            <Button
              size="small"
              variant="shade"
              outline
              onClick={togglePause}
              Icon={paused ? undefined : () => <Icons.Pause size="XS" />}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              size="small"
              variant="shade"
              outline
              onClick={() => {
                clear();
                setExpanded(new Set());
              }}
            >
              Clear
            </Button>
            <Button size="small" variant="shade" outline onClick={handleCopy}>
              Copy JSON
            </Button>
            <Button
              size="small"
              variant="shade"
              outline
              onClick={handleDownload}
            >
              Download
            </Button>
          </PanelToolbar>
          <PanelList ref={listRef} onClick={(e) => e.stopPropagation()}>
            {visible.length === 0 && (
              <EmptyHint>
                {entries.length === 0
                  ? "Trigger a contacts flow on this page to see APDU traffic. The panel captures DMK APDU send/receive, Task/Command breadcrumbs, and form submissions."
                  : "No entries match the active filter."}
              </EmptyHint>
            )}
            {visible.map((entry) => {
              const isExpanded = expanded.has(entry.id);
              return (
                <React.Fragment key={entry.id}>
                  <Row onClick={() => toggleExpand(entry.id)}>
                    <Cell>{formatTimestamp(entry.ts)}</Cell>
                    <LevelCell $level={entry.level}>
                      {levelLabel(entry.level)}
                    </LevelCell>
                    <Cell>[{entry.tag}]</Cell>
                    <Cell>
                      {entry.data ? (isExpanded ? "▾ " : "▸ ") : "  "}
                      {entry.message}
                    </Cell>
                  </Row>
                  {isExpanded && entry.data && (
                    <DataBlock>
                      {JSON.stringify(entry.data, jsonReplacer, 2)}
                    </DataBlock>
                  )}
                </React.Fragment>
              );
            })}
          </PanelList>
        </PanelBody>
      )}
    </PanelWrapper>
  );
};
