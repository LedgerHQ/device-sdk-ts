export type GetSeedIdCommandResponse = Partial<{
  readonly pubKeyHeader: Uint8Array;
  readonly pubKey: Uint8Array;
  readonly pubKeySig: Uint8Array;
  readonly attestationId: Uint8Array;
  readonly attestationHeader: Uint8Array;
  readonly attestationKey: Uint8Array;
  readonly attestationSig: Uint8Array;
}>;

export type GetSeedIdCommandArgs = {
  readonly challengeTLV: string;
};
