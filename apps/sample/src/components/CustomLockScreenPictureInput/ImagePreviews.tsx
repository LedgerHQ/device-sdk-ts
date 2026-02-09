import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  ClickablePreviewImage,
  FullscreenControlsPanel,
  FullscreenImage,
  FullscreenOverlay,
  PreviewBox,
  PreviewLabel,
} from "./styles";

export type ImagePreviewsProps = {
  src: string;
  controls?: React.ReactNode;
};

export const ImagePreview: React.FC<ImagePreviewsProps> = ({
  src,
  controls,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isFullscreen]);

  return (
    <PreviewBox>
      <ClickablePreviewImage
        src={src}
        alt="Preview"
        onClick={() => setIsFullscreen(true)}
      />
      <PreviewLabel>Preview (click to customize)</PreviewLabel>
      {isFullscreen &&
        createPortal(
          <FullscreenOverlay onClick={() => setIsFullscreen(false)}>
            {controls && (
              <FullscreenControlsPanel onClick={(e) => e.stopPropagation()}>
                {controls}
              </FullscreenControlsPanel>
            )}
            <FullscreenImage src={src} alt="Fullscreen preview" />
          </FullscreenOverlay>,
          document.body,
        )}
    </PreviewBox>
  );
};
