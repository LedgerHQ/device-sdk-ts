import {
  type AltEntryKey,
  type RequirementInstruction,
  type TxBindings,
} from "@internal/app-binder/clear-sign/requirements/model";
import {
  ActiveWhenPredicate,
  HideCondition,
  PARAM_TYPE_TOKEN_AMOUNT,
  type ParsedInstruction,
  TokenKind,
  ValueSource,
} from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import {
  accountAddressAt,
  accountAltRefAt,
  altRefForPubkeyValue,
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
 *   TOKEN_INFO. An ALT-backed token account can carry no such binding (a
 *   binding needs both halves resolved host-side), so it goes to
 *   `tokenAccountStateAltRefs` and is fetched once its address is known.
 *   A candidate-array port resolves to its first *provided*
 *   candidate. A `FALLBACK_ACCOUNT` is the mint of last resort, so its address
 *   needs TOKEN_INFO too — every `fallbackAccount` in the registry names a mint
 *   slot, and it is the only ticker source when both binding sources miss.
 * - DIRECT port: the embedded mint needs TOKEN_INFO.
 * - ACCOUNT_RESET with `requirePreBalanceZero`: mandatory TOKEN_ACCOUNT_STATE
 *   for the reset account (the device must read its pre-balance).
 * - IS_SIGNER hide rule / port activation predicate: TOKEN_ACCOUNT_STATE for the
 *   target unless a TX-derived OWNER_ASSOC binding already covers it. The
 *   device's `IS_SIGNER` predicate matches a token account only through the
 *   owner map, which it seeds from OWNER_ASSOC pairs first and from attested
 *   `TOKEN_ACCOUNT_STATE.OWNER` second. An ALT-backed target goes to
 *   `tokenAccountStateAltRefs`, the post-ALT_RESOLUTION equivalent.
 * - PARAM_TOKEN_AMOUNT display field: the amount formatter's token needs
 *   TOKEN_INFO. For CONSTANT source: always a mint. For ACCOUNT_PATH source:
 *   if covered by a TX-derived MINT_ASSOC binding, use the bound mint. If not,
 *   add as a `tokenAmountRef` (non-ALT) or `tokenAmountAltRef` (ALT-backed)
 *   so the fetch stage can try TOKEN_INFO first then fall back to
 *   TOKEN_ACCOUNT_STATE + TOKEN_INFO for the attested mint.
 */
export function applyTokenRule(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
  bindings: TxBindings,
  accumulator: RequirementAccumulator,
  bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
): void {
  const mintBindings = bindings.mints;

  for (const port of parsed.valueFlowPorts) {
    const tokenValue = port.tokenValue;
    if (tokenValue === undefined) continue;

    if (tokenValue.kind === TokenKind.RESOLVE) {
      const accountIndex =
        tokenValue.accountIndex ?? resolvePortAccountIndex(port, instruction);
      const account = accountAddressAt(instruction, accountIndex);
      if (account !== undefined) {
        const boundMint = mintBindings.get(account);
        if (boundMint === undefined) {
          accumulator.addTokenAccountState(account);
        } else {
          accumulator.addTokenInfo(boundMint);
        }
      } else {
        // ALT-backed: no MINT_ASSOC binding can cover it, so the mint has to
        // come from the attested state fetched once the entry resolves.
        requestAltState(
          accountAltRefAt(instruction, accountIndex),
          accumulator,
        );
      }
      requestFallbackMint(
        tokenValue.fallbackAccountIndex,
        instruction,
        accumulator,
      );
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

  applyOwnerAttestationRule(
    parsed,
    instruction,
    bindings,
    accumulator,
    bs58Encoder,
  );

  for (const field of parsed.displayFields) {
    if (
      field.paramType !== PARAM_TYPE_TOKEN_AMOUNT ||
      field.token === undefined
    )
      continue;

    if (field.token.source !== ValueSource.ACCOUNT_PATH) {
      // CONSTANT: hardcoded in CAL, always a mint
      const ref = resolvePubkeyValue(field.token, instruction, bs58Encoder);
      if (ref !== undefined) {
        accumulator.addTokenInfo(mintBindings.get(ref) ?? ref);
      }
      continue;
    }

    // ACCOUNT_PATH: may be a mint, an ATA, or behind an ALT
    const accountIndex =
      field.token.payload.length > 0 ? field.token.payload[0]! : undefined;
    if (accountIndex === undefined) continue;
    const account = instruction.accounts[accountIndex];
    if (account === undefined) continue;

    if (account.address !== undefined) {
      const boundMint = mintBindings.get(account.address);
      if (boundMint !== undefined) {
        accumulator.addTokenInfo(boundMint);
      } else {
        accumulator.addTokenAmountRef(account.address);
      }
    } else if (account.altRef !== undefined) {
      // ALT-backed: resolve after ALT_RESOLUTION is fetched
      accumulator.addTokenAmountAltRef(
        account.altRef.altAddress,
        account.altRef.entryIndex,
      );
    }
  }
}

/**
 * `TOKEN_VALUE.FALLBACK_ACCOUNT`: the device uses the referenced account's
 * *address* as the mint, with no further resolution. Every `fallbackAccount` an
 * overlay declares names a mint slot (`sourceMint`, `poolMint`, …), so this is
 * a real mint whose TOKEN_INFO renders the ticker whenever the port does fall
 * through — the common case for a swap into an ATA that does not exist yet.
 * Requesting it when the binding map *does* resolve the port costs nothing: all
 * mints are fetched in one batched CAL call.
 *
 * An ALT-backed fallback goes to `mintAltRefs`, the bucket that streams the
 * `ALT_RESOLUTION` finalize requires and then resolves TOKEN_INFO for the
 * resolved address.
 */
function requestFallbackMint(
  fallbackAccountIndex: number | undefined,
  instruction: RequirementInstruction,
  accumulator: RequirementAccumulator,
): void {
  if (fallbackAccountIndex === undefined) return;
  const account = instruction.accounts[fallbackAccountIndex];
  if (account === undefined) return;
  if (account.address !== undefined) {
    accumulator.addTokenInfo(account.address);
  } else if (account.altRef !== undefined) {
    accumulator.addMintAltRef(
      account.altRef.altAddress,
      account.altRef.entryIndex,
    );
  }
}

/**
 * `TOKEN_ACCOUNT_STATE` trigger path 3: an `IS_SIGNER` predicate — on a
 * `HIDE_RULE` target or on a port's `ACTIVE_WHEN` — matches a token account only
 * if the device can bind it to an owner. A TX-derived `OWNER_ASSOC` pair covers
 * that binding; otherwise the only source is the attested
 * `TOKEN_ACCOUNT_STATE.OWNER`, so request one.
 *
 * An ALT-backed target has no host-side address, so neither the binding lookup
 * nor a build-time fetch is possible: it goes to `tokenAccountStateAltRefs` and
 * the provide phase fetches the state once `ALT_RESOLUTION` names the address.
 * Skipping it would leave the owner map unseeded and the predicate false. And
 * ALT-supplied slots are never message signers, so a target reached through one
 * can only ever satisfy `IS_SIGNER` *through* the owner map — making the
 * attestation the sole path to a true answer rather than a second opinion.
 *
 * `IS_SIGNER` is the only predicate worth a descriptor. The structural ones
 * (`CREATED_IN_TRANSACTION`, `ACCOUNT_USED_ELSEWHERE`,
 * `ACCOUNT_EFFECTS_DISPLAYED_ELSEWHERE`) never read the owner map.
 * `IS_ANOTHER_SIGNER` does read it, but only to short-circuit to `false`:
 * without the binding it falls through to a header signer check, which a
 * program-owned token account can never pass, so the answer is `false` either
 * way and the descriptor changes nothing.
 *
 * The host cannot tell a token account from a plain wallet key, so a predicate
 * targeting the signer's own key costs one fetch that finds nothing. That is the
 * cheap side of the trade: without the descriptor the predicate silently
 * evaluates false and the device shows plumbing screens that should be hidden.
 */
function applyOwnerAttestationRule(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
  bindings: TxBindings,
  accumulator: RequirementAccumulator,
  bs58Encoder: Bs58Encoder,
): void {
  const request = (address: string | undefined): void => {
    if (address === undefined) return;
    if (bindings.owners.has(address)) return;
    accumulator.addTokenAccountState(address);
  };

  for (const rule of parsed.hideRules) {
    if (rule.condition !== HideCondition.IS_SIGNER) continue;
    const target = rule.target;
    if (target === undefined) continue;
    const address = resolvePubkeyValue(target, instruction, bs58Encoder);
    if (address !== undefined) {
      request(address);
    } else {
      requestAltState(altRefForPubkeyValue(target, instruction), accumulator);
    }
  }

  for (const port of parsed.valueFlowPorts) {
    if (!port.activeWhen.includes(ActiveWhenPredicate.IS_SIGNER)) continue;
    const accountIndex = resolvePortAccountIndex(port, instruction);
    const address = accountAddressAt(instruction, accountIndex);
    if (address !== undefined) {
      request(address);
    } else {
      requestAltState(accountAltRefAt(instruction, accountIndex), accumulator);
    }
  }
}

/**
 * Queue the `TOKEN_ACCOUNT_STATE` an ALT-backed account needs. No binding map is
 * consulted: a binding requires both halves resolved host-side, which an
 * ALT-supplied slot never is.
 */
function requestAltState(
  altRef: AltEntryKey | undefined,
  accumulator: RequirementAccumulator,
): void {
  if (altRef === undefined) return;
  accumulator.addTokenAccountStateAltRef(altRef.altAddress, altRef.entryIndex);
}
