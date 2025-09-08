import type { HexaString } from "@ledgerhq/device-management-kit";

import {
  type ClearSignContextSuccess,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type TransactionSubset } from "@/shared/model/TransactionSubset";

// The general informations for a typed message
export type TypedDataMessageInfo = {
  displayName: string;
  filtersCount: number;
  signature: string;
};

// Token index and descriptor. Needed for tokens that are referenced by a typed message
export type TypedDataTokenIndex = number;
export type TypedDataToken = string;
// Calldata index. Needed for calldatas that are referenced by a typed message
export type TypedDataCalldataIndex = number;
// Special token index value when the referenced token is the verifying contract
export const VERIFYING_CONTRACT_TOKEN_INDEX = 255;

// Typed message filters, to select fields to display, and provide formatting informations
export type TypedDataFilterPath = string;
export type TypedDataFilterWithToken = {
  type: "amount" | "token";
  displayName: string;
  tokenIndex: TypedDataTokenIndex;
  path: TypedDataFilterPath;
  signature: string;
};
export type TypedDataFilterWithTrustedName = {
  type: "trusted-name";
  displayName: string;
  types: string[];
  sources: string[];
  typesAndSourcesPayload: string;
  path: TypedDataFilterPath;
  signature: string;
};
export type TypedDataFilterCalldata = {
  type:
    | "calldata-value"
    | "calldata-callee"
    | "calldata-chain-id"
    | "calldata-selector"
    | "calldata-amount"
    | "calldata-spender";
  displayName: string;
  calldataIndex: TypedDataCalldataIndex;
  path: TypedDataFilterPath;
  signature: string;
};
export type TypedDataFilter =
  | {
      type: "datetime" | "raw";
      displayName: string;
      path: TypedDataFilterPath;
      signature: string;
    }
  | TypedDataFilterWithToken
  | TypedDataFilterWithTrustedName
  | TypedDataFilterCalldata;

// Calldata info when referenced by a typed message
export enum TypedDataCalldataParamPresence {
  None = "none",
  Present = "present",
  VerifyingContract = "verifying_contract",
}
export type TypedDataFilterCalldataInfo = {
  displayName: string;
  calldataIndex: TypedDataCalldataIndex;
  valueFlag: boolean;
  calleeFlag: TypedDataCalldataParamPresence;
  chainIdFlag: boolean;
  selectorFlag: boolean;
  amountFlag: boolean;
  spenderFlag: TypedDataCalldataParamPresence;
  signature: string;
};
export type TypedDataCalldataInfo = {
  filter: TypedDataFilterCalldataInfo;
  subset: TransactionSubset;
};

// Clear signing context for a typed message
export type TypedDataClearSignContextSuccess = {
  type: "success";
  messageInfo: TypedDataMessageInfo;
  filters: Record<TypedDataFilterPath, TypedDataFilter>;
  trustedNamesAddresses: Record<TypedDataFilterPath, HexaString>;
  tokens: Record<TypedDataTokenIndex, TypedDataToken>;
  calldatas: Record<TypedDataCalldataIndex, TypedDataCalldataInfo>;
  proxy:
    | ClearSignContextSuccess<ClearSignContextType.PROXY_DELEGATE_CALL>
    | undefined;
};
export type TypedDataClearSignContextError = {
  type: "error";
  error: Error;
};
export type TypedDataClearSignContext =
  | TypedDataClearSignContextSuccess
  | TypedDataClearSignContextError;
