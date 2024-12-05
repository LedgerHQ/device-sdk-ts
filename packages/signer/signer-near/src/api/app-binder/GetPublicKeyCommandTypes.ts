export type GetPublicKeyCommandResponse = string;

export type GetPublicKeyCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};
