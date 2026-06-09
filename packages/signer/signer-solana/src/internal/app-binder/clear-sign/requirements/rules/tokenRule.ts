import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  PARAM_TYPE_TOKEN_AMOUNT,
  type ParsedInstruction,
  TokenKind,
} from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import {
  accountAddressAt,
  resolvePortAccountIndex,
  resolvePubkeyValue,
} from "@internal/app-binder/clear-sign/requirements/valueResolution";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

/**
 * TOKEN_INFO + TOKEN_ACCOUNT_STATE requirements:
 * - RESOLVE port: TOKEN_ACCOUNT_STATE for its token account unless a TX-derived
 *   MINT_ASSOC binding already covers it; the bound mint (when any) needs
 *   TOKEN_INFO. A candidate-array port resolves to its first *provided*
 *   candidate.
 * - DIRECT port: the embedded mint needs TOKEN_INFO.
 * - ACCOUNT_RESET with `requirePreBalanceZero`: mandatory TOKEN_ACCOUNT_STATE
 *   for the reset account (the device must read its pre-balance).
 * - PARAM_TOKEN_AMOUNT display field: the amount formatter's token needs
 *   TOKEN_INFO. The reference may be a mint directly, or — when a TX-derived
 *   MINT_ASSOC binding covers it — a token account whose bound mint is used
 *   instead. (The chain-only token-account case where no binding exists is out
 *   of scope: DMK has no RPC to resolve such a mint, mirroring the POC, which
 *   only resolves it from on-chain balances.)
 *
 * `mintBindings` maps a token-account address to its TX-derived mint address.
 */
export function applyTokenRule(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
  mintBindings: ReadonlyMap<string, string>,
  accumulator: RequirementAccumulator,
  bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
): void {
  for (const port of parsed.valueFlowPorts) {
    const tokenValue = port.tokenValue;
    if (tokenValue === undefined) continue;

    if (tokenValue.kind === TokenKind.RESOLVE) {
      const account = accountAddressAt(
        instruction,
        tokenValue.accountIndex ?? resolvePortAccountIndex(port, instruction),
      );
      if (account === undefined) continue;
      const boundMint = mintBindings.get(account);
      if (boundMint === undefined) {
        accumulator.addTokenAccountState(account);
      } else {
        accumulator.addTokenInfo(boundMint);
      }
    } else if (tokenValue.kind === TokenKind.DIRECT && tokenValue.value) {
      const mint = resolvePubkeyValue(
        tokenValue.value,
        instruction,
        bs58Encoder,
      );
      if (mint !== undefined) accumulator.addTokenInfo(mint);
    }
  }

  for (const reset of parsed.accountResets) {
    if (!reset.requirePreBalanceZero) continue;
    const account = accountAddressAt(instruction, reset.accountIndex);
    if (account !== undefined) accumulator.addTokenAccountState(account);
  }

  for (const field of parsed.displayFields) {
    if (
      field.paramType !== PARAM_TYPE_TOKEN_AMOUNT ||
      field.token === undefined
    )
      continue;
    const ref = resolvePubkeyValue(field.token, instruction, bs58Encoder);
    if (ref === undefined) continue;
    accumulator.addTokenInfo(mintBindings.get(ref) ?? ref);
  }
}
