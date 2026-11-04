import React from "react";
import { MockServerDevice } from "@ledgerhq/device-mockserver-react";

import { ResizablePanel } from "../../components/ResizablePanel";
import { type MockServerConfig } from "../../hooks/useConnectorMessages";

export const MockScreenPanel: React.FC<{
  mockServer: MockServerConfig | null;
  rewriteUrl?: (url: string) => string;
  deviceId: string;
}> = ({ mockServer, rewriteUrl, deviceId }) => (
  <ResizablePanel
    name="live-screen"
    defaultWidth={320}
    minWidth={240}
    maxWidth={640}
    edge="left"
    className="border-l border-muted-subtle bg-surface"
  >
    <div className="flex min-h-0 flex-1 flex-col gap-16 overflow-auto p-16">
      <span className="body-4-semi-bold text-muted uppercase">Live screen</span>
      {mockServer?.sessionToken ? (
        <MockServerDevice
          url={rewriteUrl ? rewriteUrl(mockServer.url) : mockServer.url}
          token={mockServer.sessionToken}
          deviceId={deviceId}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-muted-subtle p-24 text-center body-3 text-muted">
          {mockServer
            ? "The app shares its mock server without a session token, so the device screen cannot be reached."
            : "Pass mockServer to DevToolsDmkInspector to see the device screen."}
        </p>
      )}
    </div>
  </ResizablePanel>
);
