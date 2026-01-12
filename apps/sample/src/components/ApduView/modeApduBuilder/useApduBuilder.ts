import { useCallback, useMemo, useState } from "react";
import { ApduBuilder } from "@ledgerhq/device-management-kit";

import { validateDataSegment, validateHeaderField } from "./inputValidation";
import { APDU_PRESETS } from "./presets";
import {
  type ApduHeader,
  type DataSegment,
  type DataSegmentMethod,
} from "./types";

/**
 * Hook to manage APDU builder state
 */
export function useApduBuilder() {
  const [header, setHeader] = useState<ApduHeader>({
    cla: "E0",
    ins: "01",
    p1: "00",
    p2: "00",
  });
  const [dataSegments, setDataSegments] = useState<DataSegment[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("custom");

  // Generate unique ID for segments
  const generateId = useCallback(() => {
    return `segment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Set a header field
  const setHeaderField = useCallback(
    (field: keyof ApduHeader, value: string) => {
      setHeader((prev) => ({ ...prev, [field]: value }));
      // When user modifies header, switch to custom preset
      setSelectedPresetId("custom");
    },
    [],
  );

  // Add a new data segment
  const addDataSegment = useCallback(
    (method: DataSegmentMethod) => {
      const newSegment: DataSegment = {
        id: generateId(),
        method,
        value: "",
      };
      setDataSegments((prev) => [...prev, newSegment]);
      // When user adds a segment, switch to custom preset
      setSelectedPresetId("custom");
    },
    [generateId],
  );

  // Update a data segment
  const updateDataSegment = useCallback(
    (id: string, updates: Partial<Omit<DataSegment, "id">>) => {
      setDataSegments((prev) =>
        prev.map((seg) => (seg.id === id ? { ...seg, ...updates } : seg)),
      );
      // When user modifies segments, switch to custom preset
      setSelectedPresetId("custom");
    },
    [],
  );

  // Remove a data segment
  const removeDataSegment = useCallback((id: string) => {
    setDataSegments((prev) => prev.filter((seg) => seg.id !== id));
    // When user removes a segment, switch to custom preset
    setSelectedPresetId("custom");
  }, []);

  // Apply a preset
  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = APDU_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      setSelectedPresetId(presetId);
      setHeader(preset.header);
      setDataSegments(
        preset.dataSegments.map((seg) => ({
          ...seg,
          id: generateId(),
        })),
      );
    },
    [generateId],
  );

  // Validate all inputs
  const validation = useMemo(() => {
    const headerValidation = {
      cla: validateHeaderField(header.cla),
      ins: validateHeaderField(header.ins),
      p1: validateHeaderField(header.p1),
      p2: validateHeaderField(header.p2),
    };

    const segmentValidations = dataSegments.map((seg) => ({
      id: seg.id,
      ...validateDataSegment(seg),
    }));

    const isHeaderValid = Object.values(headerValidation).every(
      (v) => v.isValid,
    );
    const areSegmentsValid = segmentValidations.every((v) => v.isValid);

    return {
      header: headerValidation,
      segments: segmentValidations,
      isValid: isHeaderValid && areSegmentsValid,
    };
  }, [header, dataSegments]);

  // Build the APDU using ApduBuilder
  const buildApdu = useCallback((): {
    rawApdu: Uint8Array | null;
    errors: string[];
  } => {
    if (!validation.isValid) return { rawApdu: null, errors: [] };

    try {
      const builder = new ApduBuilder({
        cla: parseInt(header.cla, 16),
        ins: parseInt(header.ins, 16),
        p1: parseInt(header.p1, 16),
        p2: parseInt(header.p2, 16),
      });

      for (const segment of dataSegments) {
        switch (segment.method) {
          case "add8BitUIntToData":
          case "add16BitUIntToData":
          case "add32BitUIntToData":
            builder[segment.method](parseInt(segment.value, 10));
            break;
          case "addHexaStringToData":
          case "encodeInLVFromHexa":
          case "addAsciiStringToData":
          case "encodeInLVFromAscii":
            builder[segment.method](segment.value);
            break;
        }
      }

      const apdu = builder.build();
      const builderErrors = builder.getErrors();
      return {
        rawApdu: apdu.getRawApdu(),
        errors: builderErrors.map((e) => e.message),
      };
    } catch (error) {
      console.error("Error building APDU:", error);
      return { rawApdu: null, errors: ["Unexpected error building APDU"] };
    }
  }, [validation.isValid, header, dataSegments]);

  return {
    // State
    header,
    dataSegments,
    selectedPresetId,
    validation,

    // Header actions
    setHeaderField,

    // Segment actions
    addDataSegment,
    updateDataSegment,
    removeDataSegment,

    // Preset actions
    applyPreset,

    // Build
    buildApdu,
  };
}
