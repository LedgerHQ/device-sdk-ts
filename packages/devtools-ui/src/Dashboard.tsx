import React, { useState } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { Flex } from "@ledgerhq/react-ui/components/layout/index";
import { StyleProvider } from "@ledgerhq/react-ui/styles/index";

import {
  DashboardNavigation,
  DashboardScreen,
} from "./components/DashboardNavigation";
import { useConnectorMessages } from "./hooks/useConnectorMessages";
import { DebugDevTools } from "./screens/debugDevTools";
import { Logger } from "./screens/logger";
import { Sessions } from "./screens/sessions";
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
    sendMessage,
    clearLogs,
    startListening,
    stopListening,
    startDiscovering,
    stopDiscovering,
    connectDevice,
  } = useConnectorMessages(connector);

  const [currentScreen, setCurrentScreen] = useState<DashboardScreen>(
    DashboardScreen.logs,
  );

  return (
    <Flex flexDirection="column" height="100vh" overflow="hidden">
      <DashboardNavigation
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        isLoggerConnected={isLoggerConnected}
        isInspectorConnected={isInspectorConnected}
      />
      {currentScreen === DashboardScreen.debug && (
        <DebugDevTools
          sentMessages={sentMessages}
          receivedMessages={receivedMessages}
          sendMessage={sendMessage}
        />
      )}
      {currentScreen === DashboardScreen.logs && (
        <Logger
          logs={logs}
          clearLogs={clearLogs}
          isConnected={isLoggerConnected}
        />
      )}
      {currentScreen === DashboardScreen.sessions && (
        <Sessions
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
        />
      )}
    </Flex>
  );
};

export function DashboardWithErrorBoundary({
  connector,
}: {
  connector: Connector;
}) {
  return (
    <ErrorBoundary>
      <StyleProvider selectedPalette="light">
        <Dashboard connector={connector} />
      </StyleProvider>
    </ErrorBoundary>
  );
}
