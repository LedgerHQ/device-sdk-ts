import React, { useEffect, useState } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { Flex } from "@ledgerhq/react-ui/components/layout/index";
import { StyleProvider } from "@ledgerhq/react-ui/styles/index";

import { DebugDevTools } from "./screens/debugDevTools";
import { Logger } from "./screens/logger";
import { mapConnectorMessageToLogData } from "./screens/logger/mapConnectorMessageToLogData";
import { type LogData } from "./screens/logger/types";
import { ErrorBoundary } from "./ErrorBoundary";
import { type Message } from "./PluginEvents";

enum DashboardScreen {
  debug,
  logs,
}

const Dashboard: React.FC<{ connector: Connector }> = ({ connector }) => {
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);

  useEffect(() => {
    const { unsubscribe } = connector.listenToMessages((type, payload) => {
      setReceivedMessages((prev) => [...prev, { type, payload }]);
      const logData = mapConnectorMessageToLogData({ type, payload });
      if (logData !== null) {
        setLogs((prev) => [...prev, logData]);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [connector]);

  const sendMessage = (type: string, payload: string) => {
    connector.sendMessage(type, payload);
    setSentMessages((prev) => [...prev, { type, payload }]);
  };

  const [currentView, setCurrentView] = useState<DashboardScreen>(
    DashboardScreen.logs,
  );

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <Flex flexDirection="column" height="100vh" overflow="hidden">
      <Flex flexDirection="row" columnGap={5} flexShrink={0}>
        <button onClick={() => setCurrentView(DashboardScreen.logs)}>
          Logger
        </button>
        <button onClick={() => setCurrentView(DashboardScreen.debug)}>
          Debug Dev Tools Message
        </button>
      </Flex>
      {currentView === DashboardScreen.debug && (
        <DebugDevTools
          sentMessages={sentMessages}
          receivedMessages={receivedMessages}
          sendMessage={sendMessage}
        />
      )}
      {currentView === DashboardScreen.logs && (
        <Logger logs={logs} clearLogs={clearLogs} />
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
