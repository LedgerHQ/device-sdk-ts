import React from "react";
import { Flex } from "@ledgerhq/react-ui/components/layout/index";

export enum DashboardScreen {
  debug = "debug",
  logs = "logs",
  sessions = "sessions",
}

type NavButtonProps = {
  label: string;
  isActive: boolean;
  isConnected?: boolean;
  onClick: () => void;
};

const NavButton: React.FC<NavButtonProps> = ({
  label,
  isActive,
  isConnected = true,
  onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      fontWeight: isActive ? "bold" : "normal",
      opacity: isConnected ? 1 : 0.5,
    }}
  >
    {label} {!isConnected && "(not connected)"}
  </button>
);

type DashboardNavigationProps = {
  currentScreen: DashboardScreen;
  onScreenChange: (screen: DashboardScreen) => void;
  isLoggerConnected: boolean;
  isInspectorConnected: boolean;
};

export const DashboardNavigation: React.FC<DashboardNavigationProps> = ({
  currentScreen,
  onScreenChange,
  isLoggerConnected,
  isInspectorConnected,
}) => {
  return (
    <Flex flexDirection="row" columnGap={5} flexShrink={0} padding={2}>
      <NavButton
        label="Logger"
        isActive={currentScreen === DashboardScreen.logs}
        isConnected={isLoggerConnected}
        onClick={() => onScreenChange(DashboardScreen.logs)}
      />
      <NavButton
        label="Sessions"
        isActive={currentScreen === DashboardScreen.sessions}
        isConnected={isInspectorConnected}
        onClick={() => onScreenChange(DashboardScreen.sessions)}
      />
      <NavButton
        label="Debug"
        isActive={currentScreen === DashboardScreen.debug}
        onClick={() => onScreenChange(DashboardScreen.debug)}
      />
    </Flex>
  );
};
