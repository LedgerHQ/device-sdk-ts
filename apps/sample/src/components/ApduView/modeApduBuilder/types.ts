/**
 * Available methods to add data to an APDU using ApduBuilder
 */
export type DataSegmentMethod =
  | "add8BitUIntToData"
  | "add16BitUIntToData"
  | "add32BitUIntToData"
  | "addHexaStringToData"
  | "addAsciiStringToData"
  | "encodeInLVFromHexa"
  | "encodeInLVFromAscii";

/**
 * A data segment represents a single piece of data to be added to the APDU
 */
export type DataSegment = {
  id: string;
  method: DataSegmentMethod;
  value: string;
};

/**
 * APDU header values
 */
export type ApduHeader = {
  cla: string;
  ins: string;
  p1: string;
  p2: string;
};

/**
 * Preset configuration for common APDU commands
 */
export type ApduBuilderPreset = {
  id: string;
  name: string;
  header: ApduHeader;
  dataSegments: Omit<DataSegment, "id">[];
};

/**
 * Validation result for a data segment
 */
export type DataSegmentValidation = {
  isValid: boolean;
  error?: string;
};

/**
 * Metadata for a data segment method
 */
export type DataSegmentMethodInfo = {
  label: string;
  description: string;
  inputType: "number" | "hex" | "ascii";
  maxValue?: number;
  placeholder: string;
};
