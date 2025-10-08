/**
 * src/components/VncViewer/index.tsx
 *
 * A floating VNC viewer component that connects to a WebSocket VNC server
 * Uses react-vnc library for VNC connection functionality
 */
"use client";

import React, { useCallback, useState } from "react";
import { VncScreen } from "react-vnc";
import { Box, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

interface Position {
  x: number;
  y: number;
}

const FloatingVncContainer = styled.div<{
  $position: Position;
  $isVisible: boolean;
}>`
  position: fixed;
  left: ${({ $position }) => $position.x}px;
  top: ${({ $position }) => $position.y}px;
  width: 280px;
  height: 500px;
  z-index: 999;
  display: ${({ $isVisible }) => ($isVisible ? "flex" : "none")};
  flex-direction: column;
  overflow: hidden;
`;

const VncContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

interface VncViewerProps {
  isOpen: boolean;
  url: string;
  position: Position;
}

export const VncViewer: React.FC<VncViewerProps> = ({
  isOpen,
  url,
  position,
}) => {
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleConnect = useCallback(() => {
    setConnectionError(null);
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnectionError(null);
  }, []);

  const handleCredentialsRequired = useCallback(() => {
    // For now, we'll just log this. In the future, we can add a credentials dialog
    console.log("VNC credentials required");
  }, []);

  return (
    <FloatingVncContainer $position={position} $isVisible={isOpen}>
      <VncContent>
        {isOpen && (
          <VncScreen
            url={url}
            style={{
              width: "100%",
              height: "100%",
            }}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onCredentialsRequired={handleCredentialsRequired}
            autoConnect={true}
            viewOnly={false}
            focusOnClick={true}
            clipViewport={false}
            dragViewport={false}
            scaleViewport={true}
            resizeSession={false}
            showDotCursor={false}
          />
        )}
      </VncContent>

      {connectionError && (
        <Box style={{ padding: "8px 16px", borderTop: "1px solid #e0e0e0" }}>
          <Text variant="small" color="error.c60">
            Error: {connectionError}
          </Text>
        </Box>
      )}
    </FloatingVncContainer>
  );
};
