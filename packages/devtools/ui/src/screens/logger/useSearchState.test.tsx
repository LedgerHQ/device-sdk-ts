import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { type LogData } from "./types";
import { useSearchState } from "./useSearchState";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const log = (message: string): LogData => ({
  timestamp: "2026-01-01T00:00:00.000Z",
  tag: "t",
  verbosity: "info",
  message,
  payload: {},
  payloadJSON: "{}",
});

const renderSearch = (initial: LogData[]) => {
  let state!: ReturnType<typeof useSearchState>;
  const Probe = ({ logs }: { logs: LogData[] }) => {
    state = useSearchState(logs);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(React.createElement(Probe, { logs: initial })));
  return {
    state: () => state,
    setLogs: (logs: LogData[]) =>
      act(() => root.render(React.createElement(Probe, { logs: logs }))),
    run: (action: (s: typeof state) => void) => act(() => action(state)),
  };
};

describe("useSearchState", () => {
  const a = log("apdu a");
  const b = log("other");
  const c = log("apdu c");

  it("finds the matching rows and starts on the first", () => {
    const search = renderSearch([a, b, c]);
    search.run((s) => s.setSearchQuery("apdu"));
    expect(search.state().matchIndices).toEqual([0, 2]);
    expect(search.state().currentMatchRowIndex).toBe(0);
  });

  it("wraps around when navigating", () => {
    const search = renderSearch([a, b, c]);
    search.run((s) => s.setSearchQuery("apdu"));
    search.run((s) => s.goToPrevious());
    expect(search.state().currentMatchRowIndex).toBe(2);
    search.run((s) => s.goToNext());
    expect(search.state().currentMatchRowIndex).toBe(0);
  });

  it("stays on the same log when a new matching log comes first", () => {
    const search = renderSearch([a, b, c]);
    search.run((s) => s.setSearchQuery("apdu"));
    search.run((s) => s.goToLast());
    const newer = log("apdu newer");
    search.setLogs([newer, a, b, c]);
    expect(search.state().currentMatchRowIndex).toBe(3);
  });

  it("keeps the first match it fell back to", () => {
    const search = renderSearch([a, b]);
    search.run((s) => s.setSearchQuery("apdu"));
    search.setLogs([log("apdu newer"), a, b]);
    expect(search.state().currentMatchRowIndex).toBe(1);
  });
});
