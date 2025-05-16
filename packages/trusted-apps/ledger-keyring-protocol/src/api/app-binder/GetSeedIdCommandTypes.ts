export type GetSeedIdCommandResponse = Partial<{
  readonly pubKeyHeader: Uint8Array;
  readonly pubKey: Uint8Array;
  readonly pubKeySigLength: number;
  readonly pubKeySig: Uint8Array;
  readonly attestationId: Uint8Array;
  readonly attestationHeader: Uint8Array;
  readonly attestationKey: Uint8Array;
  readonly attestationSigLength: number;
  readonly attestationSig: Uint8Array;
}>;

export type GetSeedIdCommandArgs = {
  readonly structureType: number;
  readonly version: number;
  readonly challenge: string;
  readonly signerAlgo: number;
  readonly derSignature: string;
  readonly validUntil: string;
  readonly trustedName: string;
  readonly pubKeyCurve: number;
  readonly pubKey: string;
  readonly protocolVersion: number;
};
