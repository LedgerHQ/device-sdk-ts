import type React from "react";
import { useCallback, useRef, useState } from "react";

export type FileDragDropHandlers = {
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleClick: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export type UseFileDragDropOptions = {
  disabled?: boolean;
};

export type UseFileDragDropResult = {
  isDragging: boolean;
  selectedFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handlers: FileDragDropHandlers;
};

export function useFileDragDrop({
  disabled = false,
}: UseFileDragDropOptions): UseFileDragDropResult {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file && file.type.startsWith("image/")) {
          setSelectedFile(file);
        }
      }
    },
    [disabled],
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        setSelectedFile(files[0] ?? null);
      }
    },
    [],
  );

  return {
    isDragging,
    selectedFile,
    fileInputRef,
    handlers: {
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleClick,
      handleFileChange,
    },
  };
}
