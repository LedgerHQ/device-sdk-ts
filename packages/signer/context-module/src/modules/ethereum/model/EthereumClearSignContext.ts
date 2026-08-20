import {
  type ContactExternalDecoration,
  type ContactLedgerAccountDecoration,
} from "@/modules/ethereum/contacts/domain/ContactsDataSource";
import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  type ClearSignContextSuccessBase,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type GenericPath } from "@/shared/model/GenericPath";

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

export type ClearSignContextReference<
  T extends ClearSignContextReferenceType = ClearSignContextReferenceType,
> = T extends ClearSignContextReferenceType
  ? { type: T } & ClearSignContextReferencePayloads[T]
  : never;

/**
 * Ethereum-specific payload overrides — contributed to the shared
 * ClearSignContextSuccessPayloads map at the integration boundary.
 */
export type EthereumPayloadOverrides = {
  [ClearSignContextType.ETHEREUM_ENUM]: ClearSignContextSuccessBase & {
    id: number;
    value: number;
  };
  [ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION]: ClearSignContextSuccessBase & {
    reference?: ClearSignContextReference;
  };
  // Contacts dispatch off structured fields, not opaque TLV bytes:
  // `payload` stays on the base for shape compatibility with the
  // generic dispatch path but is unused (loader sets it to "").
  // `address` carries the SDK-side address the decoration covers
  // (used by signer-eth to dedup ETHEREUM_TRUSTED_NAME contexts on the
  // same recipient — Contacts wins). Never sent on the wire.
  [ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL]: ClearSignContextSuccessBase & {
    decoration: ContactExternalDecoration;
    address: string;
  };
  [ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT]: ClearSignContextSuccessBase & {
    decoration: ContactLedgerAccountDecoration;
    address: string;
  };
};

export const EthereumClearSignContextType = {
  TOKEN: ClearSignContextType.ETHEREUM_TOKEN,
  NFT: ClearSignContextType.ETHEREUM_NFT,
  TRUSTED_NAME: ClearSignContextType.ETHEREUM_TRUSTED_NAME,
  PLUGIN: ClearSignContextType.ETHEREUM_PLUGIN,
  EXTERNAL_PLUGIN: ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN,
  TRANSACTION_INFO: ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
  PROXY_INFO: ClearSignContextType.ETHEREUM_PROXY_INFO,
  ENUM: ClearSignContextType.ETHEREUM_ENUM,
  TRANSACTION_FIELD_DESCRIPTION:
    ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
  TRANSACTION_CHECK: ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
  DYNAMIC_NETWORK: ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK,
  DYNAMIC_NETWORK_ICON: ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON,
  SAFE: ClearSignContextType.ETHEREUM_SAFE,
  SIGNER: ClearSignContextType.ETHEREUM_SIGNER,
  GATED_SIGNING: ClearSignContextType.ETHEREUM_GATED_SIGNING,
  CONTACT_EXTERNAL: ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
  CONTACT_LEDGER_ACCOUNT: ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
} as const;

/**
 * Union of all ETH-relevant success context types.
 * Excludes all SOLANA_* and CONCORDIUM_* types so ETH code never needs to handle them.
 */
export type EthereumClearSignContextSuccessType =
  (typeof EthereumClearSignContextType)[keyof typeof EthereumClearSignContextType];

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
  new Set<ClearSignContextType>(Object.values(EthereumClearSignContextType));

/**
 * Type guard that narrows a ClearSignContextSuccess to an
 * EthereumClearSignContextSuccess, filtering out non-Ethereum types.
 */
export function isEthereumClearSignContextSuccess(
  ctx: ClearSignContext,
): ctx is EthereumClearSignContextSuccess {
  return ETHEREUM_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES.has(ctx.type);
}
