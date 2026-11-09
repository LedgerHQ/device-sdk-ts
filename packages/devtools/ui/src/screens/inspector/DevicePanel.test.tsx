import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { type ConnectedDevice } from "@ledgerhq/device-management-kit";

import { DevicePanel } from "./DevicePanel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const device = (sessionId: string) =>
  ({
    sessionId,
    name: `Device ${sessionId}`,
    modelId: "nanoX",
    transport: "MOCKSERVER",
  }) as ConnectedDevice;

describe("DevicePanel", () => {
  it("shows one APDU sender after switching between sessions", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const show = (sessionId: string) =>
      act(() =>
        root.render(
          React.createElement(DevicePanel, {
            device: device(sessionId),
            exchanges: [],
            onSendApdu: () => "request",
            apduResponses: new Map(),
            clearedUpTo: undefined,
            onClear: () => {},
            onExplain: () => {},
          }),
        ),
      );

    for (const sessionId of ["a", "b", "a", "b", "c", "a"]) show(sessionId);

    expect(
      container.querySelectorAll('input[aria-label="APDU to send"]'),
    ).toHaveLength(1);
  });
});
