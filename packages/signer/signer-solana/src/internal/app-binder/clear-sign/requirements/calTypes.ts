import {
  type SolanaCalAccountReset,
  type SolanaCalActiveWhenPredicate,
  type SolanaCalDisplayField,
  type SolanaCalHideRule,
  type SolanaCalMintAssociation,
  type SolanaCalOwnerAssociation,
  type SolanaCalTokenValue,
  type SolanaCalTypePoolEntry,
  type SolanaCalValue,
  type SolanaCalValueFlowPort,
} from "@ledgerhq/context-module";

/**
 * The decoded clear-sign CAL JSON the requirement builder consumes. These alias
 * the canonical shapes context-module surfaces in `SolanaInstructionInfoPayload`
 * (single source of truth).
 */

export type CalValue = SolanaCalValue;
export type CalTokenValue = SolanaCalTokenValue;
export type CalValueFlowPort = SolanaCalValueFlowPort;
export type CalAccountReset = SolanaCalAccountReset;
export type CalDisplayField = SolanaCalDisplayField;
export type CalMintAssociation = SolanaCalMintAssociation;
export type CalOwnerAssociation = SolanaCalOwnerAssociation;
export type CalHideRule = SolanaCalHideRule;
export type CalActiveWhenPredicate = SolanaCalActiveWhenPredicate;

export type CalIdlDescriptor = {
  type_pool: SolanaCalTypePoolEntry[];
  root_type: number;
};
