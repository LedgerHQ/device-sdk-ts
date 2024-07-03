type ClearSignContextSuccess = {
  type: "token" | "nft" | "domainName" | "plugin" | "externalPlugin";
  payload: string;
};

type ClearSignContextError = {
  type: "error";
  error: Error;
};

export type ClearSignContext = ClearSignContextSuccess | ClearSignContextError;
