export type PublishedKey = {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
};

export type EncryptedPublishedKey = {
  encryptedXpriv: Uint8Array;
  initializationVector: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};

export type ParsedTlvSegment<T> = { start: number; end: number; value: T };
export type DataToParsedSegment<T extends Record<string, unknown>> = {
  [K in keyof T]: ParsedTlvSegment<T[K]>;
} & {};
