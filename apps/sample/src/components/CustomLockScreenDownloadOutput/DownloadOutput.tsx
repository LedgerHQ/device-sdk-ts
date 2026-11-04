import React, { useMemo } from "react";
import {
  decodeImageFromDevice,
  renderPixelDataToImage,
} from "@ledgerhq/dmk-ledger-wallet";

import {
  Container,
  HashText,
  MetadataContainer,
  MetadataText,
  PreviewImage,
} from "./styles";
import { type DownloadOutputProps } from "./types";

/**
 * Component to display the output of DownloadCustomLockScreenDeviceAction.
 * Reconstructs and displays the image downloaded from the device.
 */
export const DownloadOutput: React.FC<DownloadOutputProps> = ({ output }) => {
  const parsedImageData = useMemo(() => {
    // Check if this is the "already backed up" case
    if ("alreadyBackedUp" in output && output.alreadyBackedUp) {
      return null;
    }

    // Check if we have image data
    if (!("imageData" in output) || !output.imageData) {
      return null;
    }

    try {
      // Decode the device format (header + compressed data) to get raw pixel data
      return decodeImageFromDevice(output.imageData);
    } catch (e) {
      console.error("Failed to decode image from device:", e);
      return null;
    }
  }, [output]);

  const reconstructedImage = useMemo(() => {
    if (!parsedImageData) {
      return null;
    }

    try {
      // Render the raw pixel data to a displayable image
      const result = renderPixelDataToImage({
        width: parsedImageData.width,
        height: parsedImageData.height,
        pixelData: parsedImageData.pixelData,
        bitsPerPixel: parsedImageData.bitsPerPixel,
      });

      return result;
    } catch (e) {
      console.error("Failed to render image:", e);
      return null;
    }
  }, [parsedImageData]);

  // Handle "already backed up" case
  if ("alreadyBackedUp" in output && output.alreadyBackedUp) {
    return (
      <Container>
        <span className="body-2 text-success">
          Image already backed up (hash matches backupHash)
        </span>
        <MetadataText>No download was necessary</MetadataText>
      </Container>
    );
  }

  // Handle case where we have image data
  if ("imageData" in output && output.imageData) {
    return (
      <Container>
        <span className="body-2-semi-bold">Downloaded Custom Lock Screen</span>

        {reconstructedImage ? (
          <PreviewImage
            src={reconstructedImage.imageBase64DataUri}
            alt="Downloaded lock screen"
          />
        ) : (
          <span className="body-2 text-warning">
            Could not reconstruct image preview
          </span>
        )}

        <MetadataContainer>
          <MetadataText>
            Raw size: {output.imageData.length.toLocaleString()} bytes
          </MetadataText>
          {parsedImageData && (
            <>
              <MetadataText>
                Dimensions: {parsedImageData.width}x{parsedImageData.height}px
              </MetadataText>
              <MetadataText>
                Format:{" "}
                {parsedImageData.bitsPerPixel === 1
                  ? "1-bit (B&W)"
                  : "4-bit (16 grays)"}
              </MetadataText>
              <MetadataText>
                Compression: {parsedImageData.wasCompressed ? "Yes" : "No"}
              </MetadataText>
            </>
          )}
          {"imageHash" in output && output.imageHash && (
            <>
              <MetadataText>Hash:</MetadataText>
              <HashText>{output.imageHash}</HashText>
            </>
          )}
        </MetadataContainer>
      </Container>
    );
  }

  // Fallback for unexpected output format
  return (
    <Container>
      <span className="body-2 text-muted">No image data in output</span>
    </Container>
  );
};
