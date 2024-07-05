export type ClearSignContextSuccess = {
  type: "token" | "nft" | "domainName" | "plugin" | "externalPlugin";
  payload: string;
};

export type ClearSignContextError = {
  type: "error";
  error: Error;
};

export type ClearSignContext = ClearSignContextSuccess | ClearSignContextError;
