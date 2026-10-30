import React, { act } from "react";
import { createRoot } from "react-dom/client";

import {
  isConnected,
  transportLabel,
  useDebouncedStatus,
} from "./deviceStatus";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const renderStatus = (initial: string) => {
  const shown: string[] = [];
  const Probe = ({ status }: { status: string }) => {
    shown.push(useDebouncedStatus(status));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(React.createElement(Probe, { status: initial })));
  return {
    current: () => shown.at(-1),
    set: (status: string) =>
      act(() => root.render(React.createElement(Probe, { status: status }))),
  };
};

describe("useDebouncedStatus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a status other than BUSY at once", () => {
    const status = renderStatus("CONNECTED");
    status.set("LOCKED");
    expect(status.current()).toBe("LOCKED");
  });

  it("hides a short BUSY", () => {
    const status = renderStatus("CONNECTED");
    status.set("BUSY");
    act(() => vi.advanceTimersByTime(300));
    status.set("CONNECTED");
    act(() => vi.advanceTimersByTime(1000));
    expect(status.current()).toBe("CONNECTED");
  });

  it("shows a BUSY that lasts", () => {
    const status = renderStatus("CONNECTED");
    status.set("BUSY");
    act(() => vi.advanceTimersByTime(800));
    expect(status.current()).toBe("BUSY");
  });

  it("leaves BUSY at once, so polls cannot keep it stuck", () => {
    const status = renderStatus("CONNECTED");
    status.set("BUSY");
    act(() => vi.advanceTimersByTime(800));
    status.set("CONNECTED");
    expect(status.current()).toBe("CONNECTED");
  });
});

describe("device status helpers", () => {
  it("names the mock server transport", () => {
    expect(transportLabel("MOCKSERVER")).toBe("Mock server");
    expect(transportLabel("USB")).toBe("USB");
  });

  it("treats a missing state as connected", () => {
    expect(isConnected(undefined)).toBe(true);
    expect(isConnected({ deviceStatus: "NOT CONNECTED" } as never)).toBe(false);
  });
});
