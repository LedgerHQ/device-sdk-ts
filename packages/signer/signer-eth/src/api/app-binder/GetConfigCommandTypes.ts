export type GetConfigCommandResponse = {
  readonly blindSigningEnabled: boolean;
  readonly transactionChecksEnabled: boolean;
  readonly transactionChecksOptIn: boolean;
  readonly version: string;
};
