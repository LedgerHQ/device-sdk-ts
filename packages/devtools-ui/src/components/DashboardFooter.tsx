import React from "react";
import styled from "styled-components";

const FooterContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  padding: 6px 12px;
  background: #f0f0f0;
  border-top: 1px solid #ddd;
  flex-shrink: 0;
`;

const DebugButton = styled.button<{ $isOpen: boolean }>`
  padding: 4px 10px;
  border: 1px solid ${({ $isOpen }) => ($isOpen ? "#ff9800" : "#bbb")};
  border-radius: 4px;
  background: ${({ $isOpen }) => ($isOpen ? "#fff3e0" : "#fafafa")};
  color: ${({ $isOpen }) => ($isOpen ? "#e65100" : "#666")};
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${({ $isOpen }) => ($isOpen ? "#ffe0b2" : "#f0f0f0")};
    border-color: ${({ $isOpen }) => ($isOpen ? "#ff9800" : "#999")};
  }
`;

type DashboardFooterProps = {
  isDebugOpen: boolean;
  onToggleDebug: () => void;
};

export const DashboardFooter: React.FC<DashboardFooterProps> = ({
  isDebugOpen,
  onToggleDebug,
}) => {
  return (
    <FooterContainer>
      <DebugButton $isOpen={isDebugOpen} onClick={onToggleDebug}>
        {isDebugOpen ? "Close Debug Panel" : "Debug DevTools"}
      </DebugButton>
    </FooterContainer>
  );
};
