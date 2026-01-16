import { useCallback, useMemo, useState } from "react";
import { ApduParser, ApduResponse } from "@ledgerhq/device-management-kit";

import { hexStringToUint8Array } from "@/components/ApduView/hexUtils";

import { validateHexInput } from "./inputValidation";
import { PARSER_PRESETS } from "./presets";
import {
  type ExtractMethod,
  type ParserStep,
  type ParserStepResult,
} from "./types";

/**
 * Hook to manage APDU response parser state
 */
export function useApduResponseParser() {
  const [hexInput, setHexInput] = useState("");
  const [steps, setSteps] = useState<ParserStep[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("custom");

  // Generate unique ID for steps
  const generateId = useCallback(() => {
    return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Validate hex input
  const inputValidation = useMemo(() => validateHexInput(hexInput), [hexInput]);

  // Parse the APDU response
  const parsedResponse = useMemo(() => {
    if (!inputValidation.isValid) return null;

    const bytes = hexStringToUint8Array(hexInput);
    if (bytes.length < 2) return null;

    const statusCode = bytes.slice(-2);
    const data = bytes.slice(0, -2);

    return {
      statusCode,
      data,
      statusCodeHex: Array.from(statusCode)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(""),
    };
  }, [hexInput, inputValidation.isValid]);

  // Add a new parsing step
  const addStep = useCallback(
    (extractMethod: ExtractMethod) => {
      const newStep: ParserStep = {
        id: generateId(),
        extractMethod,
        encodeMethod: "none",
        label: "",
      };
      setSteps((prev) => [...prev, newStep]);
      setSelectedPresetId("custom");
    },
    [generateId],
  );

  // Update a parsing step
  const updateStep = useCallback(
    (id: string, updates: Partial<Omit<ParserStep, "id">>) => {
      setSteps((prev) =>
        prev.map((step) => (step.id === id ? { ...step, ...updates } : step)),
      );
      setSelectedPresetId("custom");
    },
    [],
  );

  // Remove a parsing step
  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
    setSelectedPresetId("custom");
  }, []);

  // Apply a preset
  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = PARSER_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      setSelectedPresetId(presetId);
      setSteps(
        preset.steps.map((step) => ({
          ...step,
          id: generateId(),
        })),
      );
      if (preset.defaultHexInput) {
        setHexInput(preset.defaultHexInput);
      }
    },
    [generateId],
  );

  // Execute parsing and get results + remaining bytes in a single pass
  const { parseResults, remainingBytes } = useMemo((): {
    parseResults: ParserStepResult[];
    remainingBytes: number | null;
  } => {
    if (!parsedResponse) return { parseResults: [], remainingBytes: null };

    const apduResponse = new ApduResponse({
      statusCode: parsedResponse.statusCode,
      data: parsedResponse.data,
    });

    const parser = new ApduParser(apduResponse);
    const results: ParserStepResult[] = [];

    for (const step of steps) {
      try {
        let rawValue:
          | Uint8Array
          | number
          | { tag: number; value: Uint8Array }
          | undefined;

        switch (step.extractMethod) {
          case "extract8BitUInt":
            rawValue = parser.extract8BitUInt();
            break;
          case "extract16BitUInt":
            rawValue = parser.extract16BitUInt();
            break;
          case "extract32BitUInt":
            rawValue = parser.extract32BitUInt();
            break;
          case "extractFieldByLength":
            rawValue = parser.extractFieldByLength(step.length ?? 0);
            break;
          case "extractFieldLVEncoded":
            rawValue = parser.extractFieldLVEncoded();
            break;
          case "extractFieldTLVEncoded":
            rawValue = parser.extractFieldTLVEncoded();
            break;
        }

        let encodedValue: string | undefined;

        if (rawValue !== undefined) {
          switch (step.encodeMethod) {
            case "none":
              if (typeof rawValue === "number") {
                encodedValue = rawValue.toString();
              } else if (rawValue instanceof Uint8Array) {
                encodedValue = parser.encodeToHexaString(rawValue);
              } else if ("tag" in rawValue) {
                encodedValue = `Tag: ${rawValue.tag}, Value: ${parser.encodeToHexaString(rawValue.value)}`;
              }
              break;
            case "encodeToHexaString":
              if (rawValue instanceof Uint8Array) {
                encodedValue = parser.encodeToHexaString(rawValue);
              } else if (typeof rawValue === "number") {
                encodedValue = rawValue.toString(16).toUpperCase();
              } else if ("tag" in rawValue) {
                encodedValue = parser.encodeToHexaString(rawValue.value);
              }
              break;
            case "encodeToString":
              if (rawValue instanceof Uint8Array) {
                encodedValue = parser.encodeToString(rawValue);
              } else if (typeof rawValue === "number") {
                encodedValue = String.fromCharCode(rawValue);
              } else if ("tag" in rawValue) {
                encodedValue = parser.encodeToString(rawValue.value);
              }
              break;
          }
        }

        results.push({
          id: step.id,
          rawValue,
          encodedValue,
          error: rawValue === undefined ? "No data available" : undefined,
        });
      } catch (error) {
        results.push({
          id: step.id,
          rawValue: undefined,
          encodedValue: undefined,
          error: error instanceof Error ? error.message : "Parsing error",
        });
      }
    }

    // Get remaining bytes from the same parser instance after all extractions
    const remaining = parser.getUnparsedRemainingLength();

    return { parseResults: results, remainingBytes: remaining };
  }, [parsedResponse, steps]);

  return {
    // Input state
    hexInput,
    setHexInput,
    inputValidation,
    parsedResponse,

    // Steps state
    steps,
    addStep,
    updateStep,
    removeStep,

    // Preset state
    selectedPresetId,
    applyPreset,

    // Results
    parseResults,
    remainingBytes,
  };
}
