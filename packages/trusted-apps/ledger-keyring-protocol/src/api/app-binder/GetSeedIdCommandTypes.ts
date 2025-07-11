export type GetSeedIdCommandResponse = {
  readonly credential: {
    readonly version: number;
    readonly curveId: number;
    readonly signAlgorithm: number;
    readonly publicKey: string;
  };
  readonly signature: string;
  readonly attestation: string;
};

export type GetSeedIdCommandArgs = {
  readonly challengeTLV: string;
};
