export type SignBlockSignatureCommandArgs = Record<string, never>;

export interface SignBlockSignatureCommandResponse {
  signature: Uint8Array;
  deviceSessionKey: Uint8Array;
}
