/**
 * src/components/MockServerScreenViewer/index.tsx
 *
 * A floating viewer that renders the device screen exposed by the mock server.
 * Unlike the Speculos VNC viewer, it does not use VNC: it polls the mock
 * server screenshot endpoint (GET /devices/:id/speculos/screenshot) and renders
 * the returned PNG. When the device is on BOLOS (the Ledger OS dashboard) there
 * is no active Speculos proxy, so a blank screen of the device-model size is
 * rendered with a "Ledger OS Mock Server" label instead.
 */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

interface Position {
  x: number;
  y: number;
}

/** Native device screen resolutions (px). */
const NATIVE_SCREEN_SIZES: Record<
  DeviceModelId,
  { width: number; height: number }
> = {
  [DeviceModelId.NANO_S]: { width: 128, height: 32 },
  [DeviceModelId.NANO_SP]: { width: 128, height: 64 },
  [DeviceModelId.NANO_X]: { width: 128, height: 64 },
  [DeviceModelId.STAX]: { width: 400, height: 672 },
  [DeviceModelId.FLEX]: { width: 480, height: 600 },
  [DeviceModelId.APEX]: { width: 300, height: 400 },
};

const DEFAULT_NATIVE_SIZE = { width: 128, height: 64 };

const MAX_DISPLAY_WIDTH = 256;
const MAX_DISPLAY_HEIGHT = 480;

/** Compute the on-screen display size while preserving the device aspect ratio. */
function getDisplaySize(deviceModel?: DeviceModelId): {
  width: number;
  height: number;
} {
  const native =
    (deviceModel && NATIVE_SCREEN_SIZES[deviceModel]) || DEFAULT_NATIVE_SIZE;
  const scale = Math.min(
    MAX_DISPLAY_WIDTH / native.width,
    MAX_DISPLAY_HEIGHT / native.height,
  );
  return {
    width: Math.round(native.width * scale),
    height: Math.round(native.height * scale),
  };
}

const FloatingContainer = styled.div<{
  $position: Position;
  $isVisible: boolean;
}>`
  position: fixed;
  left: ${({ $position }) => $position.x}px;
  top: ${({ $position }) => $position.y}px;
  z-index: 999;
  display: ${({ $isVisible }) => ($isVisible ? "flex" : "none")};
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.neutral.c20};
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
`;

const ScreenBox = styled.div<{ $width: number; $height: number }>`
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border-radius: 4px;
  overflow: hidden;
`;

const ScreenImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
`;

const BlankScreenText = styled(Text).attrs({ variant: "small" })`
  color: #000000;
  text-align: center;
  padding: 0 8px;
`;

const SCREENSHOT_POLL_INTERVAL_MS = 1000;

interface MockServerScreenViewerProps {
  isOpen: boolean;
  position: Position;
  mockServerUrl: string;
  token?: string;
  deviceId?: string;
  deviceModel?: DeviceModelId;
  /** Whether the device is currently on BOLOS (the Ledger OS dashboard). */
  isDashboard: boolean;
}

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

export const MockServerScreenViewer: React.FC<MockServerScreenViewerProps> = ({
  isOpen,
  position,
  mockServerUrl,
  token,
  deviceId,
  deviceModel,
  isDashboard,
}) => {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const displaySize = getDisplaySize(deviceModel);

  // Poll the screenshot endpoint while open, connected to a device, and not on
  // the dashboard (BOLOS has no active Speculos proxy, so no screenshot).
  useEffect(() => {
    const shouldFetch = isOpen && !isDashboard && Boolean(deviceId);

    const revokeObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    if (!shouldFetch) {
      revokeObjectUrl();
      setScreenshotUrl(null);
      return;
    }

    let cancelled = false;
    const endpoint = `${normalizeUrl(
      mockServerUrl,
    )}devices/${deviceId}/speculos/screenshot`;

    const fetchScreenshot = async () => {
      try {
        const response = await fetch(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          // The device screen changes over time, so never serve a stale cached
          // frame. This also avoids 304 revalidation responses (empty body)
          // being treated as a failed fetch.
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Unexpected status ${response.status}`);
        }
        const blob = await response.blob();
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        revokeObjectUrl();
        objectUrlRef.current = nextUrl;
        setScreenshotUrl(nextUrl);
      } catch {
        // 409 (no active Speculos proxy / on dashboard) or transient errors
        // fall back to the blank screen.
        if (cancelled) return;
        revokeObjectUrl();
        setScreenshotUrl(null);
      }
    };

    void fetchScreenshot();
    const intervalId = setInterval(() => {
      void fetchScreenshot();
    }, SCREENSHOT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      revokeObjectUrl();
    };
  }, [isOpen, isDashboard, deviceId, mockServerUrl, token]);

  const renderContent = () => {
    if (!deviceId) {
      return <BlankScreenText>No device connected</BlankScreenText>;
    }
    if (!isDashboard && screenshotUrl) {
      return <ScreenImage src={screenshotUrl} alt="Device screen" />;
    }
    return <BlankScreenText>Ledger OS Mock Server</BlankScreenText>;
  };

  return (
    <FloatingContainer $position={position} $isVisible={isOpen}>
      <ScreenBox $width={displaySize.width} $height={displaySize.height}>
        {renderContent()}
      </ScreenBox>
    </FloatingContainer>
  );
};
