import React, { useEffect, useState } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import {
  type ColorSchemeName,
  ThemeProvider,
  useTheme,
} from "@ledgerhq/lumen-ui-react";

import {
  DashboardNavigationBar,
  DashboardScreen,
} from "./components/DashboardNavigationBar";
import { useConnectorMessages } from "./hooks/useConnectorMessages";
import { AiPanel, type AiPanelRequest } from "./screens/ai/AiPanel";
import {
  AiAvailable,
  SelectionBarSlot,
  SelectionBarVisible,
} from "./screens/ai/SelectionBar";
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
  const [showLiveScreen, setShowLiveScreen] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [aiRequest, setAiRequest] = useState<AiPanelRequest | null>(null);
  const [selectionSlot, setSelectionSlot] = useState<HTMLDivElement | null>(
    null,
  );
  // Every token the app shared, so logs from an earlier session are redacted too
  const [secrets, setSecrets] = useState<string[]>([]);
  const sessionToken = mockServer?.sessionToken;
  useEffect(() => {
    if (sessionToken) {
      setSecrets((previous) =>
        previous.includes(sessionToken)
          ? previous
          : [...previous, sessionToken],
      );
    }
  }, [sessionToken]);

  const explainWithAi = (request: AiSelection) => {
    setAiOpen(true);
    setAiRequest({ ...request, id: (aiRequest?.id ?? 0) + 1 });
  };

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
      showLiveScreen={showLiveScreen}
      showSessions={showSessions}
    />
  );

  return (
    <AiAvailable.Provider value={ai !== undefined}>
      <SelectionBarSlot.Provider value={selectionSlot}>
        <div className="flex h-screen flex-col overflow-hidden bg-canvas text-base">
          <DashboardNavigationBar
            currentScreen={currentScreen}
            onScreenChange={setCurrentScreen}
            aiOpen={aiOpen}
            onToggleAi={() => setAiOpen(!aiOpen)}
            aiAvailable={ai !== undefined}
            sessions={
              currentScreen === DashboardScreen.inspector
                ? {
                    shown: showSessions,
                    onToggle: () => setShowSessions(!showSessions),
                  }
                : undefined
            }
            liveScreen={
              currentScreen === DashboardScreen.inspector && mockServer
                ? {
                    shown: showLiveScreen,
                    onToggle: () => setShowLiveScreen(!showLiveScreen),
                  }
                : undefined
            }
            isLoggerConnected={isLoggerConnected}
            isInspectorConnected={isInspectorConnected}
            mockServerWebsiteUrl={mockServerWebsiteUrl}
            colorScheme={colorScheme}
            onColorSchemeChange={onColorSchemeChange}
          />
          {/* Scrolls sideways rather than clipping a panel when the window is too narrow for all of them */}
          <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* Both stay mounted, so switching tabs keeps the Logger's pause, search and filters */}
              <div
                className={
                  currentScreen === DashboardScreen.inspector
                    ? "hidden"
                    : "contents"
                }
              >
                <SelectionBarVisible.Provider
                  value={currentScreen !== DashboardScreen.inspector}
                >
                  {logger}
                </SelectionBarVisible.Provider>
              </div>
              <div
                className={
                  currentScreen === DashboardScreen.inspector
                    ? "contents"
                    : "hidden"
                }
              >
                <SelectionBarVisible.Provider
                  value={currentScreen === DashboardScreen.inspector}
                >
                  {inspector}
                </SelectionBarVisible.Provider>
              </div>
            </div>
            {/* Hidden, not unmounted: reopening shows the last answer instead of running it again */}
            <div className={aiOpen ? "contents" : "hidden"}>
              <AiPanel ai={ai} request={aiRequest} secrets={secrets} />
            </div>
          </div>
          <div ref={setSelectionSlot} />
        </div>
      </SelectionBarSlot.Provider>
    </AiAvailable.Provider>
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
