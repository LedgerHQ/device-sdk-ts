import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import {
  type SolanaLifiPayload,
  type SolanaTokenData,
} from "@/modules/solana/model/SolanaPayloads";
import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

// Re-export Solana payload types so consumers can import from this file
export type {
  SolanaLifiInstructionMeta,
  SolanaLifiPayload,
  SolanaTokenData,
  SolanaTransactionDescriptor,
} from "@/modules/solana/model/SolanaPayloads";

/**
 * Solana-specific payload overrides — contributed to the shared
 * ClearSignContextSuccessPayloads map at the integration boundary.
 */
export type SolanaPayloadOverrides = {
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

export const SolanaContextType = {
  TOKEN: ClearSignContextType.SOLANA_TOKEN,
  LIFI: ClearSignContextType.SOLANA_LIFI,
  TRUSTED_NAME: ClearSignContextType.SOLANA_TRUSTED_NAME,
} as const;

/**
 * Union of all Solana-relevant success context types.
 */
export type SolanaClearSignContextSuccessType =
  (typeof SolanaContextType)[keyof typeof SolanaContextType];

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
  new Set<ClearSignContextType>(Object.values(SolanaContextType));

/**
 * Type guard that narrows a ClearSignContextSuccess to a
 * SolanaClearSignContextSuccess, filtering out non-Solana types.
 */
export function isSolanaContextSuccess(
  ctx: ClearSignContext,
): ctx is SolanaClearSignContextSuccess {
  return SOLANA_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES.has(ctx.type);
}
