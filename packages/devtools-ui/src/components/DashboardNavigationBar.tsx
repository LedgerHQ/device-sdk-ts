import React from "react";
import styled from "styled-components";

export enum DashboardScreen {
  logs = "logs",
  inspector = "inspector",
  splitHorizontal = "splitHorizontal",
  splitVertical = "splitVertical",
}

const NavContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
`;

const NavGroup = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: #ddd;
  margin: 0 8px;
`;

const NavButton = styled.button<{
  $isActive?: boolean;
  $isConnected?: boolean;
}>`
  padding: 6px 12px;
  border: 1px solid ${({ $isActive }) => ($isActive ? "#2196F3" : "#ddd")};
  border-radius: 4px;
  background: ${({ $isActive }) => ($isActive ? "#e3f2fd" : "white")};
  color: ${({ $isActive }) => ($isActive ? "#1976d2" : "#333")};
  font-weight: ${({ $isActive }) => ($isActive ? "600" : "normal")};
  font-size: 13px;
  cursor: pointer;
  opacity: ${({ $isConnected }) => ($isConnected === false ? 0.5 : 1)};
  transition: all 0.15s ease;

  &:hover {
    background: ${({ $isActive }) => ($isActive ? "#e3f2fd" : "#f5f5f5")};
    border-color: ${({ $isActive }) => ($isActive ? "#2196F3" : "#bbb")};
  }
`;

const SplitButton = styled.button<{ $isActive?: boolean }>`
  padding: 6px 8px;
  border: 1px solid ${({ $isActive }) => ($isActive ? "#2196F3" : "#ddd")};
  border-radius: 4px;
  background: ${({ $isActive }) => ($isActive ? "#e3f2fd" : "white")};
  color: ${({ $isActive }) => ($isActive ? "#1976d2" : "#666")};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover {
    background: ${({ $isActive }) => ($isActive ? "#e3f2fd" : "#f5f5f5")};
    border-color: ${({ $isActive }) => ($isActive ? "#2196F3" : "#bbb")};
  }
`;

const ConnectionIndicator = styled.span<{ $connected: boolean }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $connected }) => ($connected ? "#4CAF50" : "#ff9800")};
  margin-right: 6px;
`;

const SplitLabel = styled.span`
  font-size: 12px;
  color: #666;
  margin-right: 4px;
`;

// Simple SVG icons for split buttons
const SplitHorizontalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="12" height="5" rx="1" opacity="0.6" />
    <rect x="2" y="9" width="12" height="5" rx="1" />
  </svg>
);

const SplitVerticalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="5" height="12" rx="1" opacity="0.6" />
    <rect x="9" y="2" width="5" height="12" rx="1" />
  </svg>
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
    <NavContainer>
      {/* Main view buttons */}
      <NavGroup>
        <NavButton
          $isActive={currentScreen === DashboardScreen.logs}
          $isConnected={isLoggerConnected}
          onClick={() => onScreenChange(DashboardScreen.logs)}
        >
          <ConnectionIndicator $connected={isLoggerConnected} />
          Logger
        </NavButton>
        <NavButton
          $isActive={currentScreen === DashboardScreen.inspector}
          $isConnected={isInspectorConnected}
          onClick={() => onScreenChange(DashboardScreen.inspector)}
        >
          <ConnectionIndicator $connected={isInspectorConnected} />
          Inspector
        </NavButton>
      </NavGroup>

      <Divider />

      {/* Split view buttons */}
      <NavGroup>
        <SplitLabel>Split:</SplitLabel>
        <SplitButton
          $isActive={currentScreen === DashboardScreen.splitHorizontal}
          onClick={() => onScreenChange(DashboardScreen.splitHorizontal)}
          title="Split Horizontal (top/bottom)"
        >
          <SplitHorizontalIcon />
        </SplitButton>
        <SplitButton
          $isActive={currentScreen === DashboardScreen.splitVertical}
          onClick={() => onScreenChange(DashboardScreen.splitVertical)}
          title="Split Vertical (left/right)"
        >
          <SplitVerticalIcon />
        </SplitButton>
      </NavGroup>
    </NavContainer>
  );
};
