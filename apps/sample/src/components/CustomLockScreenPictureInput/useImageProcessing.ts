import { useEffect, useRef, useState } from "react";
import {
  centerCropResizeImage,
  type DitheringAlgorithm,
  encodeImageForDevice,
  loadImageFromFile,
  processImage,
  type ScreenSpecs,
} from "@ledgerhq/dmk-ledger-wallet";

export type ImageProcessingParams = {
  selectedFile: File | null;
  screenSpecs: ScreenSpecs | null;
  visibleAreaDimensions: { width: number; height: number } | null;
  debouncedContrast: number;
  compress: boolean;
  ditheringAlgorithm: DitheringAlgorithm;
};

export type ImageProcessingResult = {
  originalPreview: string | null;
  croppedPreview: string | null;
  processedPreview: string | null;
  imageDataHex: string;
  processing: boolean;
  error: string | null;
};

export function useImageProcessing(
  params: ImageProcessingParams,
): ImageProcessingResult {
  const {
    selectedFile,
    screenSpecs,
    visibleAreaDimensions,
    debouncedContrast,
    compress,
    ditheringAlgorithm,
  } = params;

  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [imageDataHex, setImageDataHex] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastProcessedFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (!selectedFile || !screenSpecs || !visibleAreaDimensions) {
      setOriginalPreview(null);
      setCroppedPreview(null);
      setProcessedPreview(null);
      setImageDataHex("");
      lastProcessedFileRef.current = null;
      return;
    }

    // Only show "Processing..." when loading a new file, not during re-processing
    const isNewFile = selectedFile !== lastProcessedFileRef.current;

    const processImageAsync = async () => {
      if (isNewFile) {
        setProcessing(true);
      }
      setError(null);

      try {
        // Load the original image for preview
        const originalImage = await loadImageFromFile(selectedFile);
        const originalCanvas = document.createElement("canvas");
        originalCanvas.width = originalImage.naturalWidth;
        originalCanvas.height = originalImage.naturalHeight;
        const originalCtx = originalCanvas.getContext("2d");
        if (originalCtx) {
          originalCtx.drawImage(originalImage, 0, 0);
          setOriginalPreview(originalCanvas.toDataURL());
        }

        // Center, crop, and resize to the visible area dimensions
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);

        reader.onload = async () => {
          try {
            const dataUri = reader.result as string;
            const centeredResult = await centerCropResizeImage(
              dataUri,
              visibleAreaDimensions,
            );
            setCroppedPreview(centeredResult.imageBase64DataUri);

            // Load the cropped image for processing
            const croppedImage = new Image();
            croppedImage.onload = async () => {
              try {
                // Process with dithering
                const result = processImage({
                  image: croppedImage,
                  contrast: debouncedContrast,
                  bitsPerPixel: screenSpecs.bitsPerPixel,
                  ditheringAlgorithm,
                });

                setProcessedPreview(result.previewResult.imageBase64DataUri);

                // Encode image data for device (with header + optional compression)
                const formattedImageData = await encodeImageForDevice({
                  pixelData: result.rawResult.pixelData,
                  compress,
                  padImage: true,
                  screenSpecs,
                });

                // Convert Uint8Array to hex string for storage
                const formattedHex = Array.from(formattedImageData)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("");

                setImageDataHex(formattedHex);
                lastProcessedFileRef.current = selectedFile;
              } catch (e) {
                console.error("Processing error:", e);
                setError(
                  e instanceof Error ? e.message : "Failed to process image",
                );
              } finally {
                setProcessing(false);
              }
            };
            croppedImage.onerror = () => {
              setError("Failed to load cropped image");
              setProcessing(false);
            };
            croppedImage.src = centeredResult.imageBase64DataUri;
          } catch (e) {
            console.error("Cropping error:", e);
            setError(e instanceof Error ? e.message : "Failed to crop image");
            setProcessing(false);
          }
        };

        reader.onerror = () => {
          setError("Failed to read file");
          setProcessing(false);
        };
      } catch (e) {
        console.error("Load error:", e);
        setError(e instanceof Error ? e.message : "Failed to load image");
        setProcessing(false);
      }
    };

    void processImageAsync();
  }, [
    selectedFile,
    screenSpecs,
    visibleAreaDimensions,
    debouncedContrast,
    compress,
    ditheringAlgorithm,
  ]);

  return {
    originalPreview,
    croppedPreview,
    processedPreview,
    imageDataHex,
    processing,
    error,
  };
}
