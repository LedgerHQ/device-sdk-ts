import React from "react";
import {
  type ColorSchemeName,
  IconButton,
  SegmentedControl,
  SegmentedControlButton,
} from "@ledgerhq/lumen-ui-react";
import { ExternalLink, Moon, Sun } from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "./WithTooltip";

export enum DashboardScreen {
  logs = "logs",
  inspector = "inspector",
}

export enum SplitMode {
  off = "off",
  horizontal = "horizontal",
  vertical = "vertical",
}

const SPLITS = [
  { mode: SplitMode.off, title: "No split", path: "" },
  {
    mode: SplitMode.horizontal,
    title: "Split horizontally (stacked)",
    path: "M2 8h12",
  },
  {
    mode: SplitMode.vertical,
    title: "Split vertically (side by side)",
    path: "M8 2.5v11",
  },
];

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
  split: SplitMode;
  onSplitChange: (split: SplitMode) => void;
  isLoggerConnected: boolean;
  isInspectorConnected: boolean;
  mockServerWebsiteUrl: string | null;
  colorScheme: "light" | "dark";
  onColorSchemeChange: (colorScheme: ColorSchemeName) => void;
};

export const DashboardNavigationBar: React.FC<DashboardNavigationBarProps> = ({
  currentScreen,
  onScreenChange,
  split,
  onSplitChange,
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
        onSelectedChange={(value) => {
          onScreenChange(value as DashboardScreen);
          onSplitChange(SplitMode.off);
        }}
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
        <SegmentedControl
          selectedValue={split}
          onSelectedChange={(value) => onSplitChange(value as SplitMode)}
          tabLayout="fit"
          className="bg-muted-transparent"
          aria-label="Split"
        >
          {SPLITS.map(({ mode, title, path }) => (
            // The tooltip goes inside: the control finds its buttons among its direct children
            <SegmentedControlButton key={mode} value={mode} aria-label={title}>
              <WithTooltip label={title} side="bottom">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
                  {path && <path d={path} />}
                </svg>
              </WithTooltip>
            </SegmentedControlButton>
          ))}
        </SegmentedControl>
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
