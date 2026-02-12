import React, { useEffect, useMemo, useState } from "react";
import {
  type CLSSupportedDeviceModelId,
  type DitheringAlgorithm,
  getScreenSpecs,
  getScreenVisibleAreaDimensions,
  isCustomLockScreenSupported,
} from "@ledgerhq/dmk-ledger-wallet";
import { Flex, Input, Switch, Text } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { useDebounce } from "@/hooks/useDebounce";

import { ImageDropZone } from "./ImageDropZone";
import { ImagePreview } from "./ImagePreviews";
import { ImageProcessingControls } from "./ImageProcessingControls";
import { PreviewContainer } from "./styles";
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
  const { originalPreview, processedPreview, imageDataHex, processing, error } =
    useImageProcessing({
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
      <PreviewContainer>
        <ImageDropZone
          originalPreview={originalPreview}
          processing={processing}
          disabled={disabled}
          isDragging={isDragging}
          error={error}
          fileInputRef={fileInputRef}
          handlers={handlers}
        />
        {processedPreview && (
          <ImagePreview
            src={processedPreview}
            controls={
              <ImageProcessingControls
                ditheringAlgorithm={ditheringAlgorithm}
                onDitheringChange={setDitheringAlgorithm}
                contrast={contrast}
                onContrastChange={setContrast}
                disabled={disabled}
                processing={processing}
              />
            }
          />
        )}
      </PreviewContainer>
      <Switch
        checked={compress}
        disabled={disabled}
        onChange={() => setCompress(!compress)}
        label="Compress image data (recommended)"
        name="compress"
      />

      <Input
        id="unlockTimeout"
        renderLeft={() => <InputLabel>unlockTimeout</InputLabel>}
        value={unlockTimeout}
        onChange={(val) => setUnlockTimeout(parseInt(String(val), 10) || 0)}
        type="number"
        disabled={disabled}
      />
    </Flex>
  );
};
