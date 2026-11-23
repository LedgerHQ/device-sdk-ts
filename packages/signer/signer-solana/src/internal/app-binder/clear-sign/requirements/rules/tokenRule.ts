import {
  type AltEntryKey,
  type RequirementInstruction,
  type TxBindings,
} from "@internal/app-binder/clear-sign/requirements/model";
import {
  PARAM_TYPE_TOKEN_AMOUNT,
  type ParsedInstruction,
  TokenKind,
  ValueKind,
  ValueSource,
} from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import {
  accountAddressAt,
  accountAltRefAt,
  resolvePortAccountIndex,
  resolvePubkeyValue,
} from "@internal/app-binder/clear-sign/requirements/valueResolution";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

/**
 * TOKEN_INFO + TOKEN_ACCOUNT_STATE requirements. The path numbers are the
 * `TOKEN_ACCOUNT_STATE` triggers of `spec/dmk/clear_signing_pipeline.md`:
 * - Path 1, RESOLVE port: TOKEN_ACCOUNT_STATE for its token account unless a TX-derived
 *   MINT_ASSOC binding already covers it; the bound mint (when any) needs
 *   TOKEN_INFO. An ALT-backed token account can carry no such binding (a
 *   binding needs both halves resolved host-side), so it goes to
 *   `tokenAccountStateAltRefs` and is fetched once its address is known.
 *   A candidate-array port resolves to its first *provided*
 *   candidate. A `FALLBACK_ACCOUNT` is the mint of last resort, so its address
 *   needs TOKEN_INFO too — every `fallbackAccount` in the registry names a mint
 *   slot, and it is the only ticker source when both binding sources miss.
 * - DIRECT port: the embedded mint needs TOKEN_INFO.
 * - Path 2, ACCOUNT_RESET: mandatory TOKEN_ACCOUNT_STATE when `requirePreBalanceZero`
 *   or `requireNativePreBalanceZero` is set (the device must read the pre-balance
 *   to validate the reset is applicable).
 * - Path 3, PARAM_TOKEN_AMOUNT display field: the amount formatter's token needs
 *   TOKEN_INFO. For CONSTANT source: always a mint. For ACCOUNT_PATH source:
 *   if covered by a TX-derived MINT_ASSOC binding, use the bound mint. If not,
 *   add as a `tokenAmountRef` (non-ALT) or `tokenAmountAltRef` (ALT-backed)
 *   so the fetch stage can try TOKEN_INFO first then fall back to
 *   TOKEN_ACCOUNT_STATE + TOKEN_INFO for the attested mint.
 * - Path 4, ACCOUNT_RESET: TOKEN_ACCOUNT_STATE for an SPL reset whose `TOKEN_VALUE`
 *   is `RESOLVE`, unless the mint is already bound by a TX-derived `MINT_ASSOC`
 *   pair or by a `FALLBACK_ACCOUNT`. Without the mint the reset resolves to no
 *   domain and establishes nothing.
 *
 * No path is keyed off the `IS_SIGNER` / `IS_ANOTHER_SIGNER` hide conditions.
 * The device decides both from its own key and the transaction's signer list
 * alone, never from the owner-binding map: a token account bound to the user is
 * owned by the user inside the Token program, but its address is not the
 * user's key, so a hide that accepted it would conceal an authority handed to
 * someone else. An attested `TOKEN_ACCOUNT_STATE.OWNER` therefore cannot change
 * either answer, and fetching one for them would only cost a round trip.
 * `ACTIVE_WHEN` has no signer predicate either (the spec keeps only
 * `CREATED_IN_TRANSACTION` and `MINT_PREDICATE`), so a port raises nothing here.
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
    if (!reset.requirePreBalanceZero && !reset.requireNativePreBalanceZero)
      continue;
    const account = accountAddressAt(instruction, reset.accountIndex);
    if (account !== undefined) {
      accumulator.addTokenAccountState(account);
    } else {
      requestAltState(
        accountAltRefAt(instruction, reset.accountIndex),
        accumulator,
      );
    }
  }

  // Path 4: TOKEN_ACCOUNT_STATE for an SPL reset whose TOKEN_VALUE is RESOLVE,
  // unless the mint is already bound by a TX-derived MINT_ASSOC pair or by a
  // FALLBACK_ACCOUNT. Without the mint the reset resolves to no domain.
  for (const reset of parsed.accountResets) {
    if (reset.valueKind !== ValueKind.SPL_TOKEN) continue;
    const tokenValue = reset.tokenValue;
    if (tokenValue === undefined || tokenValue.kind !== TokenKind.RESOLVE)
      continue;

    const accountIndex = tokenValue.accountIndex ?? reset.accountIndex;
    const account = accountAddressAt(instruction, accountIndex);

    if (account !== undefined) {
      const boundMint = mintBindings.get(account);
      if (
        boundMint === undefined &&
        tokenValue.fallbackAccountIndex === undefined
      ) {
        accumulator.addTokenAccountState(account);
      }
      if (boundMint !== undefined) {
        accumulator.addTokenInfo(boundMint);
      }
    } else {
      requestAltState(accountAltRefAt(instruction, accountIndex), accumulator);
    }

    requestFallbackMint(
      tokenValue.fallbackAccountIndex,
      instruction,
      accumulator,
    );
  }

  // Path 3: the PARAM_TOKEN_AMOUNT token reference.
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
