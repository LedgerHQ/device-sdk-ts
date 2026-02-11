export enum EthSignerActionTypes {
  GET_ADDRESS = "get-address",
  VERIFY_SAFE_ADDRESS = "verify-safe-address",
  SIGN_MESSAGE = "sign-message",
  SIGN_TRANSACTION = "sign-transaction",
  SIGN_TYPED_DATA = "sign-typed-data",
  SIGN_DELEGATION_AUTHORIZATION = "sign-delegation-authorization",
}

export type EthSignerActionType = EthSignerActionTypes;
