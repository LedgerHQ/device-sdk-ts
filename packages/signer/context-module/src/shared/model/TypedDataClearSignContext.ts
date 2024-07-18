// The general informations for a typed message
export type TypedDataMessageInfo = {
  displayName: string;
  filtersCount: number;
  signature: string;
};

// Token index and descriptor. Needed for tokens that are referenced by a typed message
export type TypedDataTokenIndex = number;
export type TypedDataToken = string;
// Special token index value when the referenced token is the verifying contract
export const VERIFYING_CONTRACT_TOKEN_INDEX = 255;

// Typed message filters, to select fields to display, and provide formatting informations
export type TypedDataFilterPath = string;
export type TypedDataFilter =
  | {
      type: "datetime" | "raw";
      displayName: string;
      path: TypedDataFilterPath;
      signature: string;
    }
  | {
      type: "amount" | "token";
      displayName: string;
      tokenIndex: TypedDataTokenIndex;
      path: TypedDataFilterPath;
      signature: string;
    };

// Clear signing context for a typed message
export type TypedDataClearSignContextSuccess = {
  type: "success";
  messageInfo: TypedDataMessageInfo;
  filters: Record<TypedDataFilterPath, TypedDataFilter>;
  tokens: Record<TypedDataTokenIndex, TypedDataToken>;
};
export type TypedDataClearSignContextError = {
  type: "error";
  error: Error;
};
export type TypedDataClearSignContext =
  | TypedDataClearSignContextSuccess
  | TypedDataClearSignContextError;