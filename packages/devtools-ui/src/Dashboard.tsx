// TODO: move this in independent package

import React, { useEffect, useState } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { Flex } from "@ledgerhq/react-ui/components/layout/index";
import { StyleProvider } from "@ledgerhq/react-ui/styles/index";

import { Logger } from "./logger/Logger";
import { mapConnectorMessageToLogData } from "./logger/mapConnectorMessageToLogData";
import { type LogData } from "./logger/types";
import { DebugDevToolsMessage } from "./DebugDevToolsMessage";
import { ErrorBoundary } from "./ErrorBoundary";
import { type Message } from "./PluginEvents";

enum DashboardView {
  DebugDevToolsMessage,
  Logger,
}

const Dashboard: React.FC<{ connector: Connector }> = ({ connector }) => {
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);

  useEffect(() => {
    connector.listenToMessages((type, payload) => {
      setReceivedMessages((prev) => [...prev, { type, payload }]);
      const logData = mapConnectorMessageToLogData({ type, payload });
      if (logData !== null) {
        setLogs((prev) => [...prev, logData]);
      }
    });
  }, [connector]);

  const sendMessage = (type: string, payload: string) => {
    connector.sendMessage(type, payload);
    setSentMessages((prev) => [...prev, { type, payload }]);
  };

  const [currentView, setCurrentView] = useState<DashboardView>(
    DashboardView.DebugDevToolsMessage,
  );

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Flex flexDirection="row" columnGap={5}>
        <button
          onClick={() => setCurrentView(DashboardView.DebugDevToolsMessage)}
        >
          Debug Dev Tools Message
        </button>
        <button onClick={() => setCurrentView(DashboardView.Logger)}>
          Logger
        </button>
      </Flex>
      {currentView === DashboardView.DebugDevToolsMessage && (
        <DebugDevToolsMessage
          sentMessages={sentMessages}
          receivedMessages={receivedMessages}
          sendMessage={sendMessage}
        />
      )}
      {currentView === DashboardView.Logger && (
        <Logger logs={logs} clearLogs={clearLogs} />
      )}
    </div>
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
