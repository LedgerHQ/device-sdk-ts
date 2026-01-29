/**
 * @file DebugDrawer component
 *
 * A slide-up drawer that displays the Debug DevTools panel.
 * Shows raw sent/received connector messages for debugging purposes.
 */

import React from "react";
import styled from "styled-components";

import { DebugDevTools } from "../screens/debugDevTools";
import { type Message } from "../shared/PluginEvents";

const DrawerOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  visibility: ${({ $isOpen }) => ($isOpen ? "visible" : "hidden")};
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
  z-index: 100;
`;

const DrawerContainer = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: white;
  border-top: 2px solid #ddd;
  transform: translateY(${({ $isOpen }) => ($isOpen ? "0" : "100%")});
  transition: transform 0.25s ease;
  z-index: 101;
  display: flex;
  flex-direction: column;
`;

const DrawerHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  flex-shrink: 0;
`;

const DrawerTitle = styled.h4`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
`;

const CloseButton = styled.button`
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #e0e0e0;
  }
`;

const DrawerContent = styled.div`
  flex: 1;
  overflow: hidden;
`;

type DebugDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  sentMessages: Message[];
  receivedMessages: Message[];
  sendMessage: (type: string, payload: string) => void;
};

export const DebugDrawer: React.FC<DebugDrawerProps> = ({
  isOpen,
  onClose,
  sentMessages,
  receivedMessages,
  sendMessage,
}) => {
  return (
    <>
      <DrawerOverlay $isOpen={isOpen} onClick={onClose} />
      <DrawerContainer $isOpen={isOpen}>
        <DrawerHeader>
          <DrawerTitle>Debug DevTools</DrawerTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </DrawerHeader>
        <DrawerContent>
          <DebugDevTools
            sentMessages={sentMessages}
            receivedMessages={receivedMessages}
            sendMessage={sendMessage}
          />
        </DrawerContent>
      </DrawerContainer>
    </>
  );
};
