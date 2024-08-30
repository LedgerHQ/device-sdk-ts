export enum ClearSignContextType {
  TOKEN = "token",
  NFT = "nft",
  DOMAIN_NAME = "domainName",
  PLUGIN = "plugin",
  EXTERNAL_PLUGIN = "externalPlugin",
  ERROR = "error",
}

export type ClearSignContextSuccess = {
  type: Exclude<ClearSignContextType, ClearSignContextType.ERROR>;
  /**
   * Hexadecimal string representation of the payload.
   */
  payload: string;
};

export type ClearSignContextError = {
  type: ClearSignContextType.ERROR;
  error: Error;
};

export type ClearSignContext = ClearSignContextSuccess | ClearSignContextError;
