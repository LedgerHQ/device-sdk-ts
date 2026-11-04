import React, { useState } from "react";

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
              <span className="body-3 text-base">
                {processing
                  ? "Processing..."
                  : "Click or drop another image to replace"}
              </span>
            </DropZoneOverlay>
          </>
        ) : (
          <DropZoneEmptyContent>
            {processing ? (
              <span className="body-2">Processing image...</span>
            ) : (
              <span className="body-2">
                Drop an image here or click to select
                <br />
                <span className="body-3 text-muted">
                  Supports JPG, PNG, GIF, WebP
                </span>
              </span>
            )}
          </DropZoneEmptyContent>
        )}
      </DropZoneWithPreview>
      {hasImage && <PreviewLabel>Original</PreviewLabel>}
      {error && <span className="body-3 text-error">Error: {error}</span>}
    </PreviewBox>
  );
};
