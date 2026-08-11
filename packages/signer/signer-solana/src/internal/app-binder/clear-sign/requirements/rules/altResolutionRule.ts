import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  type ParsedInstruction,
  ValueSource,
} from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

/**
 * Emit `ALT_RESOLUTION` requirements for every ALT-backed account that the
 * device's finalize walk resolves via `pubkey_from_account_index`. The ALT
 * cache on the device is capped at 16 entries, so only the accounts that
 * finalize actually dereferences are added:
 *
 * 1. DISPLAY_FIELD ACCOUNT_PATH entries — the device reads the pubkey for
 *    rendering, trusted-name lookup, etc.
 * 2. MINT_ASSOCIATION token-account positions — seeded into the mint-binding
 *    map. Mint positions are handled separately as `mintAltRefs` so they can
 *    be paired with a TOKEN_INFO attempt for display.
 *
 * VALUE_FLOW_PORT account indices and all other instruction accounts are
 * intentionally excluded: they are resolved host-side via TOKEN_INFO /
 * TOKEN_ACCOUNT_STATE and the device never dereferences them at finalize.
 */
export function applyAltResolutionRule(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
  accumulator: RequirementAccumulator,
): void {
  // DISPLAY_FIELD ACCOUNT_PATH: address rendered or looked up at finalize.
  for (const field of parsed.displayFields) {
    if (
      field.value?.source === ValueSource.ACCOUNT_PATH &&
      field.value.payload.length > 0
    ) {
      const accountIndex = field.value.payload[0]!;
      const account = instruction.accounts[accountIndex];
      if (account?.altRef !== undefined) {
        accumulator.addAltResolution(
          account.altRef.altAddress,
          account.altRef.entryIndex,
        );
      }
    }
  }

  // MINT_ASSOCIATION token-account positions: resolved to build the
  // mint-binding map. Mint positions (mintIndex) are emitted by the
  // separate mintAltRef pass so the provide phase can also attempt TOKEN_INFO.
  for (const { accountIndex } of parsed.info.mintAssociations) {
    const account = instruction.accounts[accountIndex];
    if (account?.altRef !== undefined) {
      accumulator.addAltResolution(
        account.altRef.altAddress,
        account.altRef.entryIndex,
      );
    }
  }
}
