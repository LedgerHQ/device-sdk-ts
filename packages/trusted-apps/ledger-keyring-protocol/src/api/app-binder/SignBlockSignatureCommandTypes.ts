export type SignBlockSignatureCommandArgs = Record<string, never>;

export interface SignBlockSignatureCommandResponse {
  signature: Uint8Array;
  sessionKey: Uint8Array;
}
