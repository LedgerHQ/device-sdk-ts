import React from "react";

import {
  PreviewBox,
  PreviewContainer,
  PreviewImage,
  PreviewLabel,
} from "./styles";

export type ImagePreviewsProps = {
  originalPreview: string | null;
  croppedPreview: string | null;
  processedPreview: string | null;
  visibleAreaDimensions: { width: number; height: number } | null;
};

export const ImagePreviews: React.FC<ImagePreviewsProps> = ({
  originalPreview,
  croppedPreview,
  processedPreview,
  visibleAreaDimensions,
}) => {
  if (!originalPreview && !croppedPreview && !processedPreview) {
    return null;
  }

  return (
    <PreviewContainer>
      {originalPreview && (
        <PreviewBox>
          <PreviewLabel>Original</PreviewLabel>
          <PreviewImage src={originalPreview} alt="Original" />
        </PreviewBox>
      )}
      {croppedPreview && (
        <PreviewBox>
          <PreviewLabel>
            Cropped ({visibleAreaDimensions?.width}x
            {visibleAreaDimensions?.height})
          </PreviewLabel>
          <PreviewImage src={croppedPreview} alt="Cropped" maxHeight={150} />
        </PreviewBox>
      )}
      {processedPreview && (
        <PreviewBox>
          <PreviewLabel>Processed (Dithered)</PreviewLabel>
          <PreviewImage
            src={processedPreview}
            alt="Processed"
            maxHeight={150}
          />
        </PreviewBox>
      )}
    </PreviewContainer>
  );
};
