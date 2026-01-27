import { Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

export const PreviewContainer = styled(Flex)`
  flex-direction: row;
  gap: 16px;
  align-items: flex-start;
`;

export const PreviewBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const MAX_SIZE = 300;

export const PreviewImage = styled.img<{ maxHeight?: number }>`
  max-width: ${MAX_SIZE}px;
  max-height: ${(p) => p.maxHeight ?? MAX_SIZE}px;
  height: ${(p) => p.maxHeight ?? MAX_SIZE}px;
  border: 2px solid transparent;
  object-fit: contain;
`;

export const PreviewLabel = styled(Text).attrs({
  variant: "small",
  color: "neutral.c70",
})``;

export const DropZone = styled.div<{ isDragging: boolean; disabled?: boolean }>`
  border: 2px dashed
    ${(p) =>
      p.isDragging ? p.theme.colors.primary.c80 : p.theme.colors.neutral.c50};
  border-radius: 8px;
  padding: 20px;
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

export const DropZoneWithPreview = styled.div<{
  isDragging: boolean;
  disabled?: boolean;
  hasImage: boolean;
}>`
  position: relative;
  border: 2px dashed
    ${(p) =>
      p.isDragging ? p.theme.colors.primary.c80 : p.theme.colors.neutral.c50};
  border-radius: 8px;
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
  background-color: ${(p) =>
    p.isDragging ? p.theme.colors.primary.c20 : "transparent"};
  opacity: ${(p) => (p.disabled ? 0.5 : 1)};
  transition: all 0.2s ease;
  height: ${MAX_SIZE}px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  &:hover {
    border-color: ${(p) =>
      p.disabled ? p.theme.colors.neutral.c50 : p.theme.colors.primary.c80};
  }
`;

export const DropZoneOverlay = styled.div<{ visible: boolean }>`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  opacity: ${(p) => (p.visible ? 1 : 0)};
  transition: opacity 0.2s ease;
  padding: 8px;
  pointer-events: none;
`;

export const DropZoneImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
`;

export const DropZoneEmptyContent = styled.div`
  padding: 20px;
  text-align: center;
`;

export const RangeInput = styled.input`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: ${(p) => p.theme.colors.neutral.c50};
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${(p) => p.theme.colors.primary.c80};
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${(p) => p.theme.colors.primary.c80};
    cursor: pointer;
    border: none;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const FullscreenOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 9999;
  cursor: pointer;
  padding: 20px;
  gap: 20px;
`;

export const FullscreenImage = styled.img`
  flex: 1;
  min-height: 0;
  max-width: 90vw;
  border: 1px solid ${(p) => p.theme.colors.neutral.c50};
  object-fit: contain;
  image-rendering: pixelated;
`;

export const ClickablePreviewImage = styled(PreviewImage)`
  cursor: pointer;
  &:hover {
    opacity: 0.8;
  }
`;

export const FullscreenControlsPanel = styled.div`
  background: rgba(0, 0, 0, 0.8);
  padding: 16px 24px;
  border-radius: 12px;
  min-width: 300px;
`;
