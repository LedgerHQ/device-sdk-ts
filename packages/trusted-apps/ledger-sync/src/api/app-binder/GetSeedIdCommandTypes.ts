export type GetSeedIdCommandResponse = {
  readonly pubKeyHeader: unknown;
  readonly pubKey: unknown;
  readonly pubKeySigLength: unknown;
  readonly pubKeySig: unknown;
  readonly attestationId: unknown;
  readonly attestationHeader: unknown;
  readonly attestationKey: unknown;
  readonly attestationSigLength: unknown;
  readonly attestationSig: unknown;
};

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
