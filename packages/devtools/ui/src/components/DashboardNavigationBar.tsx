import React from "react";
import {
  type ColorSchemeName,
  IconButton,
  SegmentedControl,
  SegmentedControlButton,
} from "@ledgerhq/lumen-ui-react";
import {
  ExternalLink,
  Moon,
  Screens,
  SparksFill,
  Sun,
} from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "./WithTooltip";

export enum DashboardScreen {
  logs = "logs",
  inspector = "inspector",
}

// Lumen has no sidebar icon: a window with its left column marked
const SidebarIcon: React.FC<{
  size?: React.ComponentProps<typeof Moon>["size"];
  className?: string;
}> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    aria-hidden="true"
    className={className}
  >
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M6 2.5v11" />
  </svg>
);

const ConnectionIndicator: React.FC<{ connected: boolean }> = ({
  connected,
}) => (
  <span
    className={`size-8 shrink-0 rounded-full ${connected ? "bg-(--color-light-green-500)" : "bg-(--color-light-yellow-500)"}`}
    title={connected ? "Connected" : "Not connected"}
  />
);

type DashboardNavigationBarProps = {
  currentScreen: DashboardScreen;
  onScreenChange: (screen: DashboardScreen) => void;
  aiOpen: boolean;
  onToggleAi: () => void;
  /** Only on the Inspector, whose sessions menu can hide. */
  sessions?: { shown: boolean; onToggle: () => void };
  /** Only when a live screen can show (the Inspector, with the app's mock server). */
  liveScreen?: { shown: boolean; onToggle: () => void };
  isLoggerConnected: boolean;
  isInspectorConnected: boolean;
  mockServerWebsiteUrl: string | null;
  colorScheme: "light" | "dark";
  onColorSchemeChange: (colorScheme: ColorSchemeName) => void;
};

export const DashboardNavigationBar: React.FC<DashboardNavigationBarProps> = ({
  currentScreen,
  onScreenChange,
  aiOpen,
  onToggleAi,
  sessions,
  liveScreen,
  isLoggerConnected,
  isInspectorConnected,
  mockServerWebsiteUrl,
  colorScheme,
  onColorSchemeChange,
}) => {
  const nextColorScheme = colorScheme === "dark" ? "light" : "dark";
  return (
    <div className="flex shrink-0 items-center gap-16 border-b border-muted-subtle px-12 py-8">
      <SegmentedControl
        selectedValue={currentScreen}
        onSelectedChange={(value) => onScreenChange(value as DashboardScreen)}
        tabLayout="fixed"
        className="w-256 shrink-0 bg-muted-transparent"
        aria-label="Screen"
      >
        <SegmentedControlButton
          value={DashboardScreen.logs}
          trailingContent={
            <ConnectionIndicator connected={isLoggerConnected} />
          }
        >
          Logger
        </SegmentedControlButton>
        <SegmentedControlButton
          value={DashboardScreen.inspector}
          trailingContent={
            <ConnectionIndicator connected={isInspectorConnected} />
          }
        >
          Inspector
        </SegmentedControlButton>
      </SegmentedControl>

      <div className="ml-auto flex items-center gap-6">
        {sessions && (
          <WithTooltip
            label={
              sessions.shown
                ? "Hide the sessions menu"
                : "Show the sessions menu"
            }
            side="bottom"
          >
            <IconButton
              aria-label={
                sessions.shown
                  ? "Hide the sessions menu"
                  : "Show the sessions menu"
              }
              aria-pressed={sessions.shown}
              icon={SidebarIcon}
              size="xs"
              appearance="transparent"
              className={`rounded-sm ${sessions.shown ? "bg-active-subtle [&>svg]:text-active" : ""}`}
              onClick={sessions.onToggle}
            />
          </WithTooltip>
        )}
        {liveScreen && (
          <WithTooltip
            label={
              liveScreen.shown ? "Hide the live screen" : "Show the live screen"
            }
            side="bottom"
          >
            <IconButton
              aria-label={
                liveScreen.shown
                  ? "Hide the live screen"
                  : "Show the live screen"
              }
              aria-pressed={liveScreen.shown}
              icon={Screens}
              size="xs"
              appearance="transparent"
              className={`rounded-sm ${liveScreen.shown ? "bg-active-subtle [&>svg]:text-active" : ""}`}
              onClick={liveScreen.onToggle}
            />
          </WithTooltip>
        )}
        <WithTooltip
          label={aiOpen ? "Hide the AI panel" : "Show the AI panel"}
          side="bottom"
        >
          <IconButton
            aria-label={aiOpen ? "Hide the AI panel" : "Show the AI panel"}
            aria-pressed={aiOpen}
            icon={SparksFill}
            size="xs"
            appearance="transparent"
            className={`rounded-sm ${aiOpen ? "bg-active-subtle [&>svg]:text-active" : ""}`}
            onClick={onToggleAi}
          />
        </WithTooltip>
        {mockServerWebsiteUrl && (
          <WithTooltip label="Open the mock server website" side="bottom">
            <IconButton
              aria-label="Open the mock server website"
              icon={ExternalLink}
              size="xs"
              appearance="transparent"
              className="rounded-sm"
              onClick={() =>
                window.open(mockServerWebsiteUrl, "_blank", "noopener")
              }
            />
          </WithTooltip>
        )}
        <WithTooltip label={`Switch to ${nextColorScheme} theme`} side="bottom">
          <IconButton
            aria-label={`Switch to ${nextColorScheme} theme`}
            icon={colorScheme === "dark" ? Sun : Moon}
            size="xs"
            appearance="transparent"
            className="rounded-sm"
            onClick={() => onColorSchemeChange(nextColorScheme)}
          />
        </WithTooltip>
      </div>
    </div>
  );
};
