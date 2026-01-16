import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

const TextAreaWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 12px;
  border-radius: 8px 8px 0 0;
  border: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  border-bottom: none;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
  color: ${({ theme }) => theme.colors.neutral.c100};
  font-family: monospace;
  font-size: 14px;
  resize: none;
  box-sizing: border-box;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary.c80};
  }

  &:focus + div {
    border-color: ${({ theme }) => theme.colors.primary.c80};
  }
`;

const ResizeHandle = styled.div<{ $isDragging: boolean }>`
  width: 100%;
  height: 12px;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
  border: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  border-top: none;
  border-radius: 0 0 8px 8px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
  box-sizing: border-box;

  &:hover,
  &:active {
    background-color: ${({ theme }) => theme.colors.neutral.c30};
  }

  &::after {
    content: "";
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background-color: ${({ theme, $isDragging }) =>
      $isDragging ? theme.colors.primary.c80 : theme.colors.neutral.c50};
  }
`;

type ResizableTextAreaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  initialHeight?: number;
  minHeight?: number;
};

export const ResizableTextArea: React.FC<ResizableTextAreaProps> = ({
  value,
  onChange,
  placeholder,
  initialHeight = 120,
  minHeight = 80,
}) => {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  // Store listeners in refs so we can clean them up on unmount
  const mouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseUpRef = useRef<(() => void) | null>(null);

  // Cleanup listeners on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (mouseMoveRef.current) {
        document.removeEventListener("mousemove", mouseMoveRef.current);
      }
      if (mouseUpRef.current) {
        document.removeEventListener("mouseup", mouseUpRef.current);
      }
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startYRef.current = e.clientY;
      startHeightRef.current = height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startYRef.current;
        const newHeight = Math.max(minHeight, startHeightRef.current + delta);
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        mouseMoveRef.current = null;
        mouseUpRef.current = null;
      };

      // Store refs for cleanup on unmount
      mouseMoveRef.current = handleMouseMove;
      mouseUpRef.current = handleMouseUp;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [height, minHeight],
  );

  return (
    <TextAreaWrapper>
      <StyledTextArea
        style={{ height }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <ResizeHandle $isDragging={isDragging} onMouseDown={handleMouseDown} />
    </TextAreaWrapper>
  );
};
