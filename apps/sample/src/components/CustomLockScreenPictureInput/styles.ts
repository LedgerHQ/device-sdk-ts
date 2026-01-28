import { Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

export const PreviewContainer = styled(Flex)`
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 16px;
`;

export const PreviewBox = styled(Flex)`
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

export const PreviewImage = styled.img<{ maxHeight?: number }>`
  max-width: 200px;
  max-height: ${(p) => p.maxHeight ?? 200}px;
  border: 1px solid ${(p) => p.theme.colors.neutral.c50};
  border-radius: 4px;
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
