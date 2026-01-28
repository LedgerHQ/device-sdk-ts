import React from "react";
import { Text } from "@ledgerhq/react-ui";

import { DropZone, HiddenInput } from "./styles";
import { type FileDragDropHandlers } from "./useFileDragDrop";

export type ImageDropZoneProps = {
  selectedFile: File | null;
  processing: boolean;
  disabled: boolean;
  isDragging: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handlers: FileDragDropHandlers;
};

export const ImageDropZone: React.FC<ImageDropZoneProps> = ({
  selectedFile,
  processing,
  disabled,
  isDragging,
  error,
  fileInputRef,
  handlers,
}) => {
  const isDisabled = disabled || processing;

  return (
    <>
      <DropZone
        isDragging={isDragging}
        disabled={isDisabled}
        onDragOver={handlers.handleDragOver}
        onDragLeave={handlers.handleDragLeave}
        onDrop={handlers.handleDrop}
        onClick={handlers.handleClick}
      >
        <HiddenInput
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlers.handleFileChange}
          disabled={isDisabled}
        />
        {processing ? (
          <Text>Processing image...</Text>
        ) : selectedFile ? (
          <Text>
            Selected: {selectedFile.name}
            <br />
            <Text variant="small" color="neutral.c70">
              Click or drop another image to replace
            </Text>
          </Text>
        ) : (
          <Text>
            Drop an image here or click to select
            <br />
            <Text variant="small" color="neutral.c70">
              Supports JPG, PNG, GIF, WebP
            </Text>
          </Text>
        )}
      </DropZone>

      {error && (
        <Text color="error.c80" variant="small">
          Error: {error}
        </Text>
      )}
    </>
  );
};
