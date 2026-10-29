import React from "react";
import {
  Divider,
  IconButton,
  SegmentedControl,
  SegmentedControlButton,
} from "@ledgerhq/lumen-ui-react";

export enum DashboardScreen {
  logs = "logs",
  inspector = "inspector",
  splitHorizontal = "splitHorizontal",
  splitVertical = "splitVertical",
}

type IconProps = { size?: number; className?: string };

const SplitHorizontalIcon = ({ size = 16, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
  >
    <rect x="2" y="2" width="12" height="5" rx="1" opacity="0.6" />
    <rect x="2" y="9" width="12" height="5" rx="1" />
  </svg>
);

const SplitVerticalIcon = ({ size = 16, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
  >
    <rect x="2" y="2" width="5" height="12" rx="1" opacity="0.6" />
    <rect x="9" y="2" width="5" height="12" rx="1" />
  </svg>
);

const ConnectionIndicator: React.FC<{ connected: boolean }> = ({
  connected,
}) => (
  <span
    className={`size-8 shrink-0 rounded-full ${connected ? "bg-success-strong" : "bg-warning-strong"}`}
    title={connected ? "Connected" : "Not connected"}
  />
);

type DashboardNavigationBarProps = {
  currentScreen: DashboardScreen;
  onScreenChange: (screen: DashboardScreen) => void;
  isLoggerConnected: boolean;
  isInspectorConnected: boolean;
};

export const DashboardNavigationBar: React.FC<DashboardNavigationBarProps> = ({
  currentScreen,
  onScreenChange,
  isLoggerConnected,
  isInspectorConnected,
}) => {
  return (
    <div className="flex shrink-0 items-center gap-12 border-b border-muted-subtle px-12 py-8">
      <SegmentedControl
        selectedValue={currentScreen}
        onSelectedChange={(value) => onScreenChange(value as DashboardScreen)}
        tabLayout="fixed"
        className="w-256 shrink-0"
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

      <Divider orientation="vertical" className="h-24" />

      <div className="flex items-center gap-4">
        <span className="body-3 text-muted">Split</span>
        <IconButton
          aria-label="Split horizontal (top/bottom)"
          title="Split horizontal (top/bottom)"
          icon={SplitHorizontalIcon}
          size="sm"
          appearance={
            currentScreen === DashboardScreen.splitHorizontal
              ? "gray"
              : "no-background"
          }
          onClick={() => onScreenChange(DashboardScreen.splitHorizontal)}
        />
        <IconButton
          aria-label="Split vertical (left/right)"
          title="Split vertical (left/right)"
          icon={SplitVerticalIcon}
          size="sm"
          appearance={
            currentScreen === DashboardScreen.splitVertical
              ? "gray"
              : "no-background"
          }
          onClick={() => onScreenChange(DashboardScreen.splitVertical)}
        />
      </div>
    </div>
  );
};
