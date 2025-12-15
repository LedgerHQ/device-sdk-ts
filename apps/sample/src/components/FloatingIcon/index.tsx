/**
 * src/components/FloatingIcon/index.tsx
 *
 * A draggable floating icon component that can be moved around the screen.
 * Uses React hooks for drag functionality and styled-components for styling.
 * Includes VNC viewer functionality when clicked.
 */
"use client";

import React, { useCallback, useRef, useState } from "react";
import { speculosIdentifier } from "@ledgerhq/device-transport-kit-speculos";
import { Icons } from "@ledgerhq/react-ui/index";
import styled from "styled-components";

import { VncViewer } from "@/components/VncViewer";
import { useSpeculosVncUrl, useTransport } from "@/state/settings/hooks";

const CONSTANTS = {
  BUTTON_SIZE: 56,
  VNC_WIDTH: 400,
  VNC_HEIGHT: 320,
  OVERLAP_SIZE: 28,
  DRAG_THRESHOLD: 10,
  DEFAULT_POSITION: { x: 350, y: 50 },
} as const;

interface Position {
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  dragStart: Position;
  elementStart: Position;
}

const FloatingContainer = styled.div<{
  $position: Position;
  $isDragging: boolean;
}>`
  position: fixed;
  left: ${({ $position }) => $position.x}px;
  top: ${({ $position }) => $position.y}px;
  width: ${CONSTANTS.BUTTON_SIZE}px;
  height: ${CONSTANTS.BUTTON_SIZE}px;
  border-radius: 50%;
  background: ${({ theme }) =>
    `linear-gradient(135deg, ${theme.colors.primary.c80}, ${theme.colors.primary.c60})`};
  box-shadow: ${({ theme, $isDragging }) =>
    $isDragging
      ? `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 2px ${theme.colors.primary.c40}`
      : `0 4px 16px rgba(0, 0, 0, 0.2)`};
  cursor: ${({ $isDragging }) => ($isDragging ? "grabbing" : "grab")};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  user-select: none;
  transition: ${({ $isDragging }) =>
    $isDragging ? "none" : "box-shadow 0.2s ease, transform 0.2s ease"};
  transform: ${({ $isDragging }) => ($isDragging ? "scale(1.05)" : "scale(1)")};

  &:hover {
    transform: ${({ $isDragging }) =>
      $isDragging ? "scale(1.05)" : "scale(1.1)"};
    box-shadow: ${({ theme }) =>
      `0 6px 24px rgba(0, 0, 0, 0.25), 0 0 0 2px ${theme.colors.primary.c40}`};
  }

  &:active {
    transform: scale(0.95);
  }
`;

const IconContent = styled.div`
  color: white;
  font-size: 24px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
`;

interface FloatingIconProps {
  initialPosition?: Position;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const FloatingIcon: React.FC<FloatingIconProps> = ({
  initialPosition,
  onDragStart,
  onDragEnd,
}) => {
  const transport = useTransport();
  const speculosVncUrl = useSpeculosVncUrl();

  const [position, setPosition] = useState<Position>(
    initialPosition || CONSTANTS.DEFAULT_POSITION,
  );
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    elementStart: { x: 0, y: 0 },
  });
  const [isVncOpen, setIsVncOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const calculateBounds = useCallback(
    (newX: number, newY: number, vncOpen: boolean): Position => {
      if (vncOpen) {
        return {
          x: Math.max(
            CONSTANTS.OVERLAP_SIZE,
            Math.min(
              window.innerWidth - CONSTANTS.VNC_WIDTH + CONSTANTS.OVERLAP_SIZE,
              newX,
            ),
          ),
          y: Math.max(
            CONSTANTS.OVERLAP_SIZE,
            Math.min(
              window.innerHeight -
                CONSTANTS.VNC_HEIGHT +
                CONSTANTS.OVERLAP_SIZE,
              newY,
            ),
          ),
        };
      }
      return {
        x: Math.max(
          0,
          Math.min(window.innerWidth - CONSTANTS.BUTTON_SIZE, newX),
        ),
        y: Math.max(
          0,
          Math.min(window.innerHeight - CONSTANTS.BUTTON_SIZE, newY),
        ),
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Capture the pointer to ensure we continue receiving events even if
      // the mouse moves over other elements (like the VNC viewer)
      if (containerRef.current) {
        containerRef.current.setPointerCapture(e.pointerId);
      }

      setDragState({
        isDragging: true,
        dragStart: { x: e.clientX, y: e.clientY },
        elementStart: position, // Always use the base position
      });

      onDragStart?.();
    },
    [position, onDragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.isDragging) return;

      const deltaX = e.clientX - dragState.dragStart.x;
      const deltaY = e.clientY - dragState.dragStart.y;

      // Calculate new base position
      const newX = dragState.elementStart.x + deltaX;
      const newY = dragState.elementStart.y + deltaY;

      // Keep within screen bounds
      const boundedPosition = calculateBounds(newX, newY, isVncOpen);
      setPosition(boundedPosition);
    },
    [dragState, isVncOpen, calculateBounds],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragState.isDragging) {
        // Release the pointer capture
        if (containerRef.current) {
          containerRef.current.releasePointerCapture(e.pointerId);
        }

        setDragState((prev) => ({ ...prev, isDragging: false }));

        const deltaX = Math.abs(e.clientX - dragState.dragStart.x);
        const deltaY = Math.abs(e.clientY - dragState.dragStart.y);

        if (
          deltaX < CONSTANTS.DRAG_THRESHOLD &&
          deltaY < CONSTANTS.DRAG_THRESHOLD
        ) {
          setIsVncOpen(!isVncOpen);
        }

        onDragEnd?.();
      }
    },
    [dragState.isDragging, onDragEnd, dragState.dragStart, isVncOpen],
  );

  // Calculate VNC position based on button position
  const getVncPosition = useCallback((): Position => {
    return {
      x: position.x + CONSTANTS.OVERLAP_SIZE,
      y: position.y + CONSTANTS.OVERLAP_SIZE,
    };
  }, [position]);

  // Calculate button position when VNC is open (top-left of VNC)
  const getButtonPosition = useCallback((): Position => {
    if (isVncOpen) {
      return {
        x: position.x,
        y: position.y,
      };
    }
    return position;
  }, [isVncOpen, position]);

  // Handle window resize to keep icon in bounds
  React.useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => calculateBounds(prev.x, prev.y, isVncOpen));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [calculateBounds, isVncOpen]);

  if (transport !== speculosIdentifier) {
    return null;
  }

  return (
    <>
      <FloatingContainer
        ref={containerRef}
        $position={getButtonPosition()}
        $isDragging={dragState.isDragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <IconContent>
          <Icons.Nano />
        </IconContent>
      </FloatingContainer>

      <VncViewer
        isOpen={isVncOpen}
        url={speculosVncUrl || ""}
        position={getVncPosition()}
      />
    </>
  );
};
