import React, { useState } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { StyleProvider } from "@ledgerhq/react-ui/styles/index";
import styled from "styled-components";

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

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`;

const ContentArea = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

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
    <DashboardContainer>
      <DashboardNavigationBar
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        isLoggerConnected={isLoggerConnected}
        isInspectorConnected={isInspectorConnected}
      />
      <ContentArea>{content}</ContentArea>
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
    </DashboardContainer>
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
