import React, { useState } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { ThemeProvider } from "@ledgerhq/lumen-ui-react";

import { DashboardFooter } from "./components/DashboardFooter";
import {
  DashboardNavigationBar,
  DashboardScreen,
} from "./components/DashboardNavigationBar";
import { DebugDrawer } from "./components/DebugDrawer";
import { SplitView } from "./components/SplitView";
import { useConnectorMessages } from "./hooks/useConnectorMessages";
import { Inspector } from "./screens/inspector";
import { Logger } from "./screens/logger";
import { ErrorBoundary } from "./ErrorBoundary";

const Dashboard: React.FC<{ connector: Connector }> = ({ connector }) => {
  const {
    receivedMessages,
    sentMessages,
    logs,
    connectedDevices,
    sessionStates,
    discoveredDevices,
    isListening,
    isActivelyDiscovering,
    isLoggerConnected,
    isInspectorConnected,
    providerValue,
    apduResponses,
    sendMessage,
    clearLogs,
    startListening,
    stopListening,
    startDiscovering,
    stopDiscovering,
    connectDevice,
    getProvider,
    setProvider,
    sendApdu,
  } = useConnectorMessages(connector);

  const [currentScreen, setCurrentScreen] = useState<DashboardScreen>(
    DashboardScreen.logs,
  );
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const logger = (
    <Logger logs={logs} clearLogs={clearLogs} isConnected={isLoggerConnected} />
  );

  const inspector = (
    <Inspector
      devices={connectedDevices}
      sessionStates={sessionStates}
      discoveredDevices={discoveredDevices}
      isListening={isListening}
      isActivelyDiscovering={isActivelyDiscovering}
      sendMessage={sendMessage}
      isConnected={isInspectorConnected}
      startListening={startListening}
      stopListening={stopListening}
      startDiscovering={startDiscovering}
      stopDiscovering={stopDiscovering}
      connectDevice={connectDevice}
      providerValue={providerValue}
      getProvider={getProvider}
      setProvider={setProvider}
      sendApdu={sendApdu}
      apduResponses={apduResponses}
    />
  );

  const content = (() => {
    switch (currentScreen) {
      case DashboardScreen.logs:
        return logger;
      case DashboardScreen.inspector:
        return inspector;
      case DashboardScreen.splitHorizontal:
        return (
          <SplitView direction="horizontal" first={logger} second={inspector} />
        );
      case DashboardScreen.splitVertical:
        return (
          <SplitView direction="vertical" first={logger} second={inspector} />
        );
      default:
        return logger;
    }
  })();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-base">
      <DashboardNavigationBar
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        isLoggerConnected={isLoggerConnected}
        isInspectorConnected={isInspectorConnected}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {content}
      </div>
      <DashboardFooter
        isDebugOpen={isDebugOpen}
        onToggleDebug={() => setIsDebugOpen(!isDebugOpen)}
      />
      <DebugDrawer
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        sentMessages={sentMessages}
        receivedMessages={receivedMessages}
        sendMessage={sendMessage}
      />
    </div>
  );
};

export function DashboardWithErrorBoundary({
  connector,
}: {
  connector: Connector;
}) {
  return (
    <ThemeProvider colorScheme="system">
      <ErrorBoundary>
        <Dashboard connector={connector} />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
