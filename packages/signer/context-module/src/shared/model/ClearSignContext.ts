import { type PkiCertificate } from "@/chain-agnostic-loaders/pki/model/PkiCertificate";

import { type GenericPath } from "./GenericPath";

// Solana payload types (defined here to avoid circular deps with SolanaContextTypes)
export type SolanaTokenData = {
  solanaTokenDescriptor: {
    data: string;
    signature: string;
  };
};

export type SolanaTransactionDescriptor = {
  data: string;
  descriptorType: string;
  descriptorVersion: string;
  signature: string;
};

export type SolanaLifiInstructionMeta = {
  program_id: string;
  discriminator_hex?: string;
};

export type SolanaLifiPayload = {
  descriptors: Record<string, SolanaTransactionDescriptor>;
  instructions: SolanaLifiInstructionMeta[];
};

export enum ClearSignContextType {
  ERROR = "error",
  CONCORDIUM_ACCOUNT_OWNERSHIP = "accountOwnership",
  ETHEREUM_TOKEN = "ethereumToken",
  ETHEREUM_NFT = "ethereumNft",
  ETHEREUM_TRUSTED_NAME = "ethereumTrustedName",
  ETHEREUM_PLUGIN = "ethereumPlugin",
  ETHEREUM_EXTERNAL_PLUGIN = "ethereumExternalPlugin",
  ETHEREUM_TRANSACTION_INFO = "ethereumTransactionInfo",
  ETHEREUM_PROXY_INFO = "ethereumProxyInfo",
  ETHEREUM_ENUM = "ethereumEnum",
  ETHEREUM_TRANSACTION_FIELD_DESCRIPTION = "ethereumTransactionFieldDescription",
  ETHEREUM_WEB3_CHECK = "ethereumWeb3Check",
  ETHEREUM_DYNAMIC_NETWORK = "ethereumDynamicNetwork",
  ETHEREUM_DYNAMIC_NETWORK_ICON = "ethereumDynamicNetworkIcon",
  ETHEREUM_SAFE = "ethereumSafe",
  ETHEREUM_SIGNER = "ethereumSigner",
  ETHEREUM_GATED_SIGNING = "ethereumGatedSigning",
  SOLANA_TOKEN = "solanaToken",
  SOLANA_LIFI = "solanaLifi",
  SOLANA_TRUSTED_NAME = "solanaTrustedName",
}

export enum ClearSignContextReferenceType {
  TOKEN = ClearSignContextType.ETHEREUM_TOKEN,
  NFT = ClearSignContextType.ETHEREUM_NFT,
  TRUSTED_NAME = ClearSignContextType.ETHEREUM_TRUSTED_NAME,
  ENUM = ClearSignContextType.ETHEREUM_ENUM,
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
  [ClearSignContextType.ETHEREUM_ENUM]: ClearSignContextSuccessBase & {
    id: number;
    value: number;
  };
  [ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION]: ClearSignContextSuccessBase & {
    reference?: ClearSignContextReference;
  };
  [ClearSignContextType.SOLANA_TOKEN]: {
    payload: SolanaTokenData;
    certificate?: PkiCertificate;
  };
  [ClearSignContextType.SOLANA_LIFI]: {
    payload: SolanaLifiPayload;
    certificate?: PkiCertificate;
  };
  [ClearSignContextType.SOLANA_TRUSTED_NAME]: {
    payload: Uint8Array;
    certificate?: PkiCertificate;
  };
};

type ClearSignContextSuccessPayloads = Omit<
  ClearSignContextSuccessPayloadsBase,
  | ClearSignContextType.ETHEREUM_ENUM
  | ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION
  | ClearSignContextType.SOLANA_TOKEN
  | ClearSignContextType.SOLANA_LIFI
  | ClearSignContextType.SOLANA_TRUSTED_NAME
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

/**
 * Union of all ETH-relevant success context types.
 * Excludes all SOLANA_* types so ETH code never needs to handle them.
 */
export type EthereumClearSignContextSuccessType =
  | ClearSignContextType.ETHEREUM_TOKEN
  | ClearSignContextType.ETHEREUM_NFT
  | ClearSignContextType.ETHEREUM_TRUSTED_NAME
  | ClearSignContextType.ETHEREUM_PLUGIN
  | ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN
  | ClearSignContextType.ETHEREUM_TRANSACTION_INFO
  | ClearSignContextType.ETHEREUM_PROXY_INFO
  | ClearSignContextType.ETHEREUM_ENUM
  | ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION
  | ClearSignContextType.ETHEREUM_WEB3_CHECK
  | ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK
  | ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON
  | ClearSignContextType.ETHEREUM_SAFE
  | ClearSignContextType.ETHEREUM_SIGNER
  | ClearSignContextType.ETHEREUM_GATED_SIGNING;

/**
 * A ClearSignContextSuccess narrowed to only Ethereum-relevant types.
 */
export type EthereumClearSignContextSuccess =
  ClearSignContextSuccess<EthereumClearSignContextSuccessType>;

/**
 * Set of all ETH-relevant ClearSignContextType values.
 * Used by the type guard below to filter out non-ETH contexts at runtime.
 */
export const ETHEREUM_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES =
  new Set<ClearSignContextType>([
    ClearSignContextType.ETHEREUM_TOKEN,
    ClearSignContextType.ETHEREUM_NFT,
    ClearSignContextType.ETHEREUM_TRUSTED_NAME,
    ClearSignContextType.ETHEREUM_PLUGIN,
    ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN,
    ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
    ClearSignContextType.ETHEREUM_PROXY_INFO,
    ClearSignContextType.ETHEREUM_ENUM,
    ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
    ClearSignContextType.ETHEREUM_WEB3_CHECK,
    ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK,
    ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON,
    ClearSignContextType.ETHEREUM_SAFE,
    ClearSignContextType.ETHEREUM_SIGNER,
    ClearSignContextType.ETHEREUM_GATED_SIGNING,
  ]);

/**
 * Type guard that narrows a ClearSignContextSuccess to an
 * EthereumClearSignContextSuccess, filtering out Solana types.
 */
export function isEthereumClearSignContextSuccess(
  ctx: ClearSignContext,
): ctx is EthereumClearSignContextSuccess {
  return ETHEREUM_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES.has(ctx.type);
}

/**
 * Union of all Solana-relevant success context types.
 */
export type SolanaClearSignContextSuccessType =
  | ClearSignContextType.SOLANA_TOKEN
  | ClearSignContextType.SOLANA_LIFI
  | ClearSignContextType.SOLANA_TRUSTED_NAME;

/**
 * A ClearSignContextSuccess narrowed to only Solana-relevant types.
 */
export type SolanaClearSignContextSuccess =
  ClearSignContextSuccess<SolanaClearSignContextSuccessType>;

/**
 * Set of all Solana-relevant ClearSignContextType values.
 * Used by the type guard below to filter out non-Solana contexts at runtime.
 */
export const SOLANA_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES =
  new Set<ClearSignContextType>([
    ClearSignContextType.SOLANA_TOKEN,
    ClearSignContextType.SOLANA_LIFI,
    ClearSignContextType.SOLANA_TRUSTED_NAME,
  ]);

/**
 * Type guard that narrows a ClearSignContextSuccess to a
 * SolanaClearSignContextSuccess, filtering out non-Solana types.
 */
export function isSolanaContextSuccess(
  ctx: ClearSignContext,
): ctx is SolanaClearSignContextSuccess {
  return SOLANA_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES.has(ctx.type);
}
