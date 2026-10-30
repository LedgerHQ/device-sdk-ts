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
} from "./components/DashboardNavigationBar";
import { DebugDrawer } from "./components/DebugDrawer";
import { useConnectorMessages } from "./hooks/useConnectorMessages";
import { AiPanel, type AiPanelRequest } from "./screens/ai/AiPanel";
import { type AiClient, type AiSelection } from "./screens/ai/types";
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
  rewriteMockServerUrl?: (url: string) => string;
  ai?: AiClient;
}> = ({ connector, onColorSchemeChange, rewriteMockServerUrl, ai }) => {
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
    mockServer,
    apduResponses,
    sendMessage,
    clearLogs,
    startListening,
    stopListening,
    startDiscovering,
    stopDiscovering,
    connectDevice,
    sendApdu,
  } = useConnectorMessages(connector);

  // The mock server website joins the session given in the URL fragment. Without
  // the app's token it would open another session, and the URL comes from the
  // app, so only a website is linked
  const mockServerWebsiteUrl =
    mockServer?.sessionToken && /^https?:\/\//i.test(mockServer.url)
      ? `${mockServer.url.replace(/\/$/, "")}/#token=${mockServer.sessionToken}`
      : null;

  const [currentScreen, setCurrentScreen] = useState<DashboardScreen>(
    DashboardScreen.logs,
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRequest, setAiRequest] = useState<AiPanelRequest | null>(null);
  const explainWithAi = (request: AiSelection) => {
    const token = mockServer?.sessionToken;
    const context = token
      ? request.context.replaceAll(token, "<session-token>")
      : request.context;
    setAiOpen(true);
    setAiRequest({ ...request, context, id: (aiRequest?.id ?? 0) + 1 });
  };
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const logger = (
    <Logger
      logs={logs}
      clearLogs={clearLogs}
      isConnected={isLoggerConnected}
      onExplain={explainWithAi}
    />
  );

  const inspector = (
    <Inspector
      devices={connectedDevices}
      sessionStates={sessionStates}
      discoveredDevices={discoveredDevices}
      isListening={isListening}
      isActivelyDiscovering={isActivelyDiscovering}
      isConnected={isInspectorConnected}
      startListening={startListening}
      stopListening={stopListening}
      startDiscovering={startDiscovering}
      stopDiscovering={stopDiscovering}
      connectDevice={connectDevice}
      sendApdu={sendApdu}
      apduResponses={apduResponses}
      logs={logs}
      mockServer={mockServer}
      rewriteMockServerUrl={rewriteMockServerUrl}
      onExplain={explainWithAi}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-base">
      <DashboardNavigationBar
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen(!aiOpen)}
        isLoggerConnected={isLoggerConnected}
        isInspectorConnected={isInspectorConnected}
        mockServerWebsiteUrl={mockServerWebsiteUrl}
        colorScheme={colorScheme}
        onColorSchemeChange={onColorSchemeChange}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Both stay mounted, so switching tabs keeps the Logger's pause, search and filters */}
            <div
              className={
                currentScreen === DashboardScreen.inspector
                  ? "hidden"
                  : "contents"
              }
            >
              {logger}
            </div>
            <div
              className={
                currentScreen === DashboardScreen.inspector
                  ? "contents"
                  : "hidden"
              }
            >
              {inspector}
            </div>
        </div>
        {aiOpen && <AiPanel ai={ai} request={aiRequest} />}
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
  rewriteMockServerUrl,
  ai,
}: {
  connector: Connector;
  /** Lets a host route the mock server calls elsewhere, e.g. through a proxy its CSP allows. */
  rewriteMockServerUrl?: (url: string) => string;
  /** Runs Claude for the AI panel; only a host that can run Claude Code provides one. */
  ai?: AiClient;
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
          rewriteMockServerUrl={rewriteMockServerUrl}
          ai={ai}
        />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
