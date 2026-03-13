import { type PkiCertificate } from "@/pki/model/PkiCertificate";

import { type GenericPath } from "./GenericPath";

export enum ClearSignContextType {
  TOKEN = "token",
  NFT = "nft",
  TRUSTED_NAME = "trustedName",
  PLUGIN = "plugin",
  EXTERNAL_PLUGIN = "externalPlugin",
  TRANSACTION_INFO = "transactionInfo",
  PROXY_INFO = "proxyInfo",
  ENUM = "enum",
  TRANSACTION_FIELD_DESCRIPTION = "transactionFieldDescription",
  TRANSACTION_CHECK = "transactionCheck",
  DYNAMIC_NETWORK = "dynamicNetwork",
  DYNAMIC_NETWORK_ICON = "dynamicNetworkIcon",
  ERROR = "error",
  SAFE = "safe",
  SIGNER = "signer",
  GATED_SIGNING = "gatedSigning",
}

export enum ClearSignContextReferenceType {
  TOKEN = ClearSignContextType.TOKEN,
  NFT = ClearSignContextType.NFT,
  TRUSTED_NAME = ClearSignContextType.TRUSTED_NAME,
  ENUM = ClearSignContextType.ENUM,
  CALLDATA = "calldata",
}

type PathOnly = {
  valuePath: GenericPath;
  value?: never;
  callee?: GenericPath;
  selector?: GenericPath;
  amount?: GenericPath;
  spender?: GenericPath;
  chainId?: GenericPath;
};

type ValueOnly = {
  value: string;
  valuePath?: never;
};

type PathOrValue = PathOnly | ValueOnly;

// per-type payloads for references
type ClearSignContextReferencePayloads = {
  [ClearSignContextReferenceType.ENUM]: {
    valuePath: GenericPath;
    id: number; // enum id to reference
  };
  [ClearSignContextReferenceType.TRUSTED_NAME]: {
    valuePath: GenericPath;
    types: string[];
    sources: string[];
  };
  [ClearSignContextReferenceType.CALLDATA]: {
    callee: GenericPath;
    valuePath: GenericPath;
    selector?: GenericPath;
    amount?: GenericPath;
    spender?: GenericPath;
    chainId?: GenericPath;
  };
  [ClearSignContextReferenceType.TOKEN]: PathOrValue;
  [ClearSignContextReferenceType.NFT]: PathOrValue;
};

// discriminated union of all reference shapes, built from the payload map
type ClearSignContextReferenceUnion = {
  [T in ClearSignContextReferenceType]: {
    type: T;
  } & ClearSignContextReferencePayloads[T];
}[ClearSignContextReferenceType];

export type ClearSignContextReference<
  T extends ClearSignContextReferenceType = ClearSignContextReferenceType,
> = Extract<ClearSignContextReferenceUnion, { type: T }>;

export type ClearSignContextSuccessType = Exclude<
  ClearSignContextType,
  ClearSignContextType.ERROR
>;

// base payload shared by most success contexts
type ClearSignContextSuccessBase = {
  payload: string;
  certificate?: PkiCertificate;
};

// map from ClearSign success type to payload
type ClearSignContextSuccessPayloadsBase = {
  [K in ClearSignContextSuccessType]: ClearSignContextSuccessBase;
};

// special cases overrides for certain context types
type ClearSignContextSuccessPayloadOverrides = {
  [ClearSignContextType.ENUM]: ClearSignContextSuccessBase & {
    id: number;
    value: number;
  };
  [ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION]: ClearSignContextSuccessBase & {
    reference?: ClearSignContextReference;
  };
};

type ClearSignContextSuccessPayloads = Omit<
  ClearSignContextSuccessPayloadsBase,
  ClearSignContextType.ENUM | ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION
> &
  ClearSignContextSuccessPayloadOverrides;

// union of all success contexts, built from the payload map.
type ClearSignContextSuccessUnion = {
  [T in ClearSignContextSuccessType]: {
    type: T;
  } & ClearSignContextSuccessPayloads[T];
}[ClearSignContextSuccessType];

export type ClearSignContextSuccess<
  T extends ClearSignContextSuccessType = ClearSignContextSuccessType,
> = Extract<ClearSignContextSuccessUnion, { type: T }>;

export type ClearSignContextError = {
  type: ClearSignContextType.ERROR;
  error: Error;
};

export type ClearSignContext = ClearSignContextSuccess | ClearSignContextError;
