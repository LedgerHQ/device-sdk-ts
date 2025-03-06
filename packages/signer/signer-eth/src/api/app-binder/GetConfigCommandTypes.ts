export type GetConfigCommandResponse = {
  readonly blindSigningEnabled: boolean;
  readonly web3ChecksEnabled: boolean;
  readonly web3ChecksOptIn: boolean;
  readonly version: string;
};
