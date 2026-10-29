import React, { useEffect, useState } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import {
  type ColorSchemeName,
  ThemeProvider,
  useTheme,
} from "@ledgerhq/lumen-ui-react";

import { DashboardFooter } from "./components/DashboardFooter";
import {
  DashboardNavigationBar,
  DashboardScreen,
  SplitMode,
} from "./components/DashboardNavigationBar";
import { DebugDrawer } from "./components/DebugDrawer";
import { SplitView } from "./components/SplitView";
import { useConnectorMessages } from "./hooks/useConnectorMessages";
import { Inspector } from "./screens/inspector";
import { Logger } from "./screens/logger";
import { ErrorBoundary } from "./ErrorBoundary";

const COLOR_SCHEME_STORAGE_KEY = "devtools-color-scheme";

function loadColorScheme(): ColorSchemeName {
  try {
    const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Ignore errors, follow the system
  }
  return "system";
}

function saveColorScheme(colorScheme: ColorSchemeName): void {
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme);
  } catch {
    // Ignore errors (e.g., storage full, private mode)
  }
}

const Dashboard: React.FC<{
  connector: Connector;
  onColorSchemeChange: (colorScheme: ColorSchemeName) => void;
}> = ({ connector, onColorSchemeChange }) => {
  const { colorScheme } = useTheme();
  useEffect(() => {
    document.documentElement.style.colorScheme = colorScheme;
  }, [colorScheme]);

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
  const [split, setSplit] = useState(SplitMode.off);
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
    switch (split) {
      case SplitMode.horizontal:
        return (
          <SplitView direction="horizontal" first={logger} second={inspector} />
        );
      case SplitMode.vertical:
        return (
          <SplitView direction="vertical" first={logger} second={inspector} />
        );
      default:
        return currentScreen === DashboardScreen.inspector ? inspector : logger;
    }
  })();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-base">
      <DashboardNavigationBar
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        split={split}
        onSplitChange={setSplit}
        isLoggerConnected={isLoggerConnected}
        isInspectorConnected={isInspectorConnected}
        colorScheme={colorScheme}
        onColorSchemeChange={onColorSchemeChange}
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
  const [colorScheme, setColorScheme] = useState(loadColorScheme);
  const changeColorScheme = (next: ColorSchemeName) => {
    setColorScheme(next);
    saveColorScheme(next);
  };
  return (
    <ThemeProvider colorScheme={colorScheme}>
      <ErrorBoundary>
        <Dashboard
          connector={connector}
          onColorSchemeChange={changeColorScheme}
        />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
