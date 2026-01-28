import React, { useEffect, useMemo, useState } from "react";
import {
  type CLSSupportedDeviceModelId,
  type DitheringAlgorithm,
  getScreenSpecs,
  getScreenVisibleAreaDimensions,
  isCustomLockScreenSupported,
} from "@ledgerhq/dmk-ledger-wallet";
import { Flex, Text } from "@ledgerhq/react-ui";

import { useDebounce } from "@/hooks/useDebounce";

import { ImageDropZone } from "./ImageDropZone";
import { ImagePreviews } from "./ImagePreviews";
import { ImageProcessingControls } from "./ImageProcessingControls";
import { type PictureInputProps } from "./types";
import { useFileDragDrop } from "./useFileDragDrop";
import { useImageProcessing } from "./useImageProcessing";

export const PictureInput: React.FC<PictureInputProps> = ({
  initialValues,
  onChange,
  deviceModelId,
  disabled = false,
}) => {
  // Image processing options state
  const [ditheringAlgorithm, setDitheringAlgorithm] =
    useState<DitheringAlgorithm>("floyd-steinberg");
  const [contrast, setContrast] = useState(1);
  const debouncedContrast = useDebounce(contrast, 300);
  const [compress, setCompress] = useState(true);
  const [unlockTimeout, setUnlockTimeout] = useState(
    initialValues.unlockTimeout,
  );

  // Device support and screen specs
  const isSupported = useMemo(
    () => isCustomLockScreenSupported(deviceModelId),
    [deviceModelId],
  );

  const screenSpecs = useMemo(() => {
    if (!isSupported) return null;
    return getScreenSpecs(deviceModelId as CLSSupportedDeviceModelId);
  }, [deviceModelId, isSupported]);

  const visibleAreaDimensions = useMemo(() => {
    if (!isSupported) return null;
    return getScreenVisibleAreaDimensions(
      deviceModelId as CLSSupportedDeviceModelId,
    );
  }, [deviceModelId, isSupported]);

  // File drag and drop handling
  const { isDragging, selectedFile, fileInputRef, handlers } = useFileDragDrop({
    disabled,
  });

  // Image processing
  const {
    originalPreview,
    croppedPreview,
    processedPreview,
    imageDataHex,
    processing,
    error,
  } = useImageProcessing({
    selectedFile,
    screenSpecs,
    visibleAreaDimensions,
    debouncedContrast,
    compress,
    ditheringAlgorithm,
  });

  // Notify parent when output values change
  useEffect(() => {
    onChange({ imageDataHex, unlockTimeout });
  }, [imageDataHex, unlockTimeout, onChange]);

  if (!isSupported) {
    return (
      <Flex flexDirection="column" rowGap={3}>
        <Text color="warning.c80">
          Custom lock screen is not supported on this device model (
          {deviceModelId}).
        </Text>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" rowGap={5}>
      <Flex flexDirection="column" rowGap={2}>
        <Text variant="small" color="neutral.c70">
          Target screen: {screenSpecs?.width}x{screenSpecs?.height}px,{" "}
          {screenSpecs?.bitsPerPixel === 1 ? "Black & White" : "16 Gray Levels"}
        </Text>

        <ImageDropZone
          selectedFile={selectedFile}
          processing={processing}
          disabled={disabled}
          isDragging={isDragging}
          error={error}
          fileInputRef={fileInputRef}
          handlers={handlers}
        />
      </Flex>

      <ImageProcessingControls
        ditheringAlgorithm={ditheringAlgorithm}
        onDitheringChange={setDitheringAlgorithm}
        contrast={contrast}
        onContrastChange={setContrast}
        compress={compress}
        onCompressChange={setCompress}
        unlockTimeout={unlockTimeout}
        onUnlockTimeoutChange={setUnlockTimeout}
        disabled={disabled}
        processing={processing}
      />

      <ImagePreviews
        originalPreview={originalPreview}
        croppedPreview={croppedPreview}
        processedPreview={processedPreview}
        visibleAreaDimensions={visibleAreaDimensions}
      />
    </Flex>
  );
};
