/**
 * Available extract methods from ApduParser
 */
export type ExtractMethod =
  | "extract8BitUInt"
  | "extract16BitUInt"
  | "extract32BitUInt"
  | "extractFieldByLength"
  | "extractFieldLVEncoded"
  | "extractFieldTLVEncoded";

/**
 * Encoding options for extracted values
 */
export type EncodeMethod = "none" | "encodeToHexaString" | "encodeToString";

/**
 * A parsing step represents a single extraction operation
 */
export type ParserStep = {
  id: string;
  extractMethod: ExtractMethod;
  encodeMethod: EncodeMethod;
  /** Length parameter for extractFieldByLength */
  length?: number;
  /** Label to describe what this step extracts */
  label: string;
};

/**
 * Result of a parsing step
 */
export type ParserStepResult = {
  id: string;
  rawValue:
    | Uint8Array
    | number
    | { tag: number; value: Uint8Array }
    | undefined;
  encodedValue: string | undefined;
  error?: string;
};

/**
 * Preset configuration for common parsing patterns
 */
export type ApduResponseParserPreset = {
  id: string;
  name: string;
  steps: Omit<ParserStep, "id">[];
  /** Default hex input to pre-fill when preset is selected */
  defaultHexInput?: string;
};

/**
 * Metadata for each extract method
 */
export type ExtractMethodInfo = {
  label: string;
  description: string;
  hasLengthParam: boolean;
};
