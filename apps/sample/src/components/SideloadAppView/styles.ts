import styled from "styled-components";

export const DropZone = styled.div<{ isDragging: boolean; disabled?: boolean }>`
  border: 2px dashed
    ${(p) =>
      p.isDragging ? p.theme.colors.primary.c80 : p.theme.colors.neutral.c50};
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
  background-color: ${(p) =>
    p.isDragging ? p.theme.colors.primary.c20 : "transparent"};
  opacity: ${(p) => (p.disabled ? 0.5 : 1)};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${(p) =>
      p.disabled ? p.theme.colors.neutral.c50 : p.theme.colors.primary.c80};
  }
`;

export const HiddenInput = styled.input`
  display: none;
`;

export const ProgressTrack = styled.div`
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background-color: ${(p) => p.theme.colors.neutral.c40};
  overflow: hidden;
`;

export const ProgressFill = styled.div<{ pct: number }>`
  height: 100%;
  border-radius: 4px;
  background-color: ${(p) => p.theme.colors.primary.c80};
  width: ${(p) => Math.min(100, Math.max(0, p.pct))}%;
  transition: width 0.2s ease;
`;
