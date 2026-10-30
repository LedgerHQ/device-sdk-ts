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
  SparksFill,
  Sun,
} from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "./WithTooltip";

export enum DashboardScreen {
  logs = "logs",
  inspector = "inspector",
}

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
