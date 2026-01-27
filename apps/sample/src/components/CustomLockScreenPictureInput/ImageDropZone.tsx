import React, { useState } from "react";
import { Text } from "@ledgerhq/react-ui";

import {
  DropZoneEmptyContent,
  DropZoneImage,
  DropZoneOverlay,
  DropZoneWithPreview,
  HiddenInput,
  PreviewBox,
  PreviewLabel,
} from "./styles";
import { type FileDragDropHandlers } from "./useFileDragDrop";

export type ImageDropZoneProps = {
  originalPreview: string | null;
  processing: boolean;
  disabled: boolean;
  isDragging: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handlers: FileDragDropHandlers;
};

export const ImageDropZone: React.FC<ImageDropZoneProps> = ({
  originalPreview,
  processing,
  disabled,
  isDragging,
  error,
  fileInputRef,
  handlers,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isDisabled = disabled || processing;
  const hasImage = !!originalPreview;

  return (
    <PreviewBox>
      <DropZoneWithPreview
        isDragging={isDragging}
        disabled={isDisabled}
        hasImage={hasImage}
        onDragOver={handlers.handleDragOver}
        onDragLeave={handlers.handleDragLeave}
        onDrop={handlers.handleDrop}
        onClick={handlers.handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <HiddenInput
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlers.handleFileChange}
          disabled={isDisabled}
        />
        {hasImage ? (
          <>
            <DropZoneImage src={originalPreview} alt="Selected" />
            <DropZoneOverlay visible={isHovered || isDragging}>
              <Text variant="small" color="neutral.c100">
                {processing
                  ? "Processing..."
                  : "Click or drop another image to replace"}
              </Text>
            </DropZoneOverlay>
          </>
        ) : (
          <DropZoneEmptyContent>
            {processing ? (
              <Text>Processing image...</Text>
            ) : (
              <Text>
                Drop an image here or click to select
                <br />
                <Text variant="small" color="neutral.c70">
                  Supports JPG, PNG, GIF, WebP
                </Text>
              </Text>
            )}
          </DropZoneEmptyContent>
        )}
      </DropZoneWithPreview>
      {hasImage && <PreviewLabel>Original</PreviewLabel>}
      {error && (
        <Text color="error.c80" variant="small">
          Error: {error}
        </Text>
      )}
    </PreviewBox>
  );
};
