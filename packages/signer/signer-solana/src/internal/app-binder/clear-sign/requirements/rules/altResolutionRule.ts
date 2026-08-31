import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  PARAM_TYPE_TOKEN_AMOUNT,
  type ParsedInstruction,
  type ParsedValue,
  TokenKind,
  ValueSource,
} from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import { resolvePortAccountIndex } from "@internal/app-binder/clear-sign/requirements/valueResolution";

/**
 * Emit `ALT_RESOLUTION` requirements for the ALT-backed accounts the device's
 * finalize walk dereferences through `pubkey_from_account_index`. That helper
 * returns NULL for an ALT slot with no attested resolution, and the device then
 * either marks a result incomplete or refuses to sign. The covered categories:
 *
 * 1. Every **writable** account of the instruction's raw account list. This is
 *    what lets `collect_writable_accounts` report `complete`, without which the
 *    merge scan stops at the instruction and two mergeable screens stay apart.
 * 2. Every `VALUE_FLOW_PORT` account candidate — the whole candidate array, not
 *    just the first: the device walks them in order and refuses on the first
 *    in-range candidate it cannot resolve.
 * 3. Every port token reference: the `RESOLVE` token account (with the port's
 *    own account as its fallback) and any `ACCOUNT_PATH` token value.
 * 4. Every `DISPLAY_FIELD` `ACCOUNT_PATH` address — read for rendering,
 *    trusted-name lookup, etc.
 * 5. Every `PARAM_TOKEN_AMOUNT` token reference sourced from an `ACCOUNT_PATH`.
 * 6. Every `MINT_ASSOCIATION` token-account position, seeded into the
 *    mint-binding map. Mint positions are handled separately as `mintAltRefs`
 *    so they can be paired with a TOKEN_INFO attempt for display.
 * 7. Every `ACCOUNT_RESET` account index.
 *
 * Deliberately excluded, to keep device heap use down: read-only ALT accounts
 * that no port, token reference, display field, association or reset names. The
 * only site that reads them is `collect_all_accounts`, and a slot missing there
 * only weakens `condition_account_used_elsewhere` — it cannot cost merge
 * compaction, it can only make the device show more screens, never fewer and
 * never a wrong value.
 */
export function applyAltResolutionRule(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
  accumulator: RequirementAccumulator,
): void {
  // Requests a resolution for one account slot; out-of-range slots and
  // statically-resolved ones are no-ops. The accumulator dedupes on
  // `(altAddress, entryIndex)`, so overlapping categories cost nothing.
  const requestAccount = (accountIndex: number | undefined): void => {
    if (accountIndex === undefined) return;
    const altRef = instruction.accounts[accountIndex]?.altRef;
    if (altRef === undefined) return;
    accumulator.addAltResolution(altRef.altAddress, altRef.entryIndex);
  };

  const requestValue = (value: ParsedValue | undefined): void => {
    if (value?.source !== ValueSource.ACCOUNT_PATH) return;
    if (value.payload.length === 0) return;
    requestAccount(value.payload[0]!);
  };

  // 1. Writable accounts of the raw account list.
  instruction.accounts.forEach((account, index) => {
    if (account.isWritable) requestAccount(index);
  });

  // 2 + 3. Port account candidates and their token references.
  for (const port of parsed.valueFlowPorts) {
    for (const candidate of port.accountIndices) requestAccount(candidate);

    const { tokenValue } = port;
    if (tokenValue === undefined) continue;
    if (tokenValue.kind === TokenKind.RESOLVE) {
      requestAccount(
        tokenValue.accountIndex ?? resolvePortAccountIndex(port, instruction),
      );
    }
    requestValue(tokenValue.value);
  }

  // 4 + 5. DISPLAY_FIELD addresses and PARAM_TOKEN_AMOUNT token references.
  for (const field of parsed.displayFields) {
    requestValue(field.value);
    if (field.paramType === PARAM_TYPE_TOKEN_AMOUNT) requestValue(field.token);
  }

  // 6. MINT_ASSOCIATION token-account positions. Mint positions (mintIndex) are
  // emitted by the separate mintAltRef pass so the provide phase can also
  // attempt TOKEN_INFO.
  for (const { accountIndex } of parsed.info.mintAssociations) {
    requestAccount(accountIndex);
  }

  // 7. ACCOUNT_RESET targets.
  for (const { accountIndex } of parsed.accountResets) {
    requestAccount(accountIndex);
  }
}
