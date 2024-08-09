// As defined in https://eips.ethereum.org/EIPS/eip-712

export interface TypedData {
  domain: TypedDataDomain;
  types: Record<string, Array<TypedDataField>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
}

export interface TypedDataField {
  name: string;
  type: string;
}
