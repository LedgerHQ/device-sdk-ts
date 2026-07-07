# @ledgerhq/solana-tools

Helpers for fetching a real Solana transaction and "crafting" it so the original
fee payer (and, optionally, other accounts) is re-pointed to addresses you
control. The crafted transaction can then be signed on-device for clear-sign
testing without broadcasting anything.

## Crafting a transaction

`SolanaTools.craftTransaction` takes either a serialized transaction
(`serialisedTransaction`) or a transaction signature to fetch by RPC
(`transactionSignature`), re-points the chosen accounts, and returns the crafted
message as base64.

```ts
const { observable } = solanaTools.craftTransaction({
  derivationPath: "44'/501'/0'/0'",
  serialisedTransaction: base64Message,
  rpcUrl, // used to resolve address lookup tables and to fetch by signature
  replacements: {
    // optional, base58 old -> new
    [oldAccount]: newAccount,
  },
});
```

Internally the crafted path deserializes the input
(`internal/services/crafter/deserialize.ts`), resolves the transaction's address
lookup tables over RPC (`internal/services/AltResolverService.ts`), then
decompiles, replaces, and recompiles on real public keys
(`internal/services/TransactionCrafterService.ts`).

### Two replacement modes

- **Auto-detect mode (default).** The on-device public key becomes the new
  payer: the old payer maps to it, and the old payer's associated token accounts
  (TOKEN and TOKEN-2022) map to the new payer's ATAs. This handles "sign this as
  me" with no manual input, including ATAs supplied through a lookup table.
- **Explicit-map mode.** The `replacements` map is applied verbatim and overrides
  the auto-detected entries on a key collision. The caller supplies the new
  address directly, so any account can be re-pointed, including ones that
  auto-detect cannot derive (see below). The two modes compose: auto-detect seeds
  the map and explicit entries add or override.

An ALT-supplied account is referenced as `(table, index)` and its address lives
in the on-chain table, not in the transaction bytes. The crafter resolves the
table, replaces the account, and lets the new address fall back into the static
keys on recompile; untouched accounts keep using their tables.

## Limitations

- **Non-ATA user PDAs in auto-detect mode.** Accounts derived from the user with
  a program-specific seed scheme (stake, lending, open-orders, and so on) cannot
  be re-derived without the program IDL, so auto-detect leaves them pointing at
  the original user. Pass them through `replacements` to re-point them.
- **Multiple signers.** A single device can only produce one signature. When the
  source transaction needs more than one signer, only the payer is re-pointed and
  the co-signers are left in place; the crafted transaction logs a warning and
  cannot be fully co-signed.
- **Transaction size.** Promoting an ALT-supplied account into the static keys
  costs bytes (the 32-byte address replaces a 1-byte table index). Re-pointing
  many accounts in a dense route can push the message over Solana's 1232-byte
  limit; the crafter surfaces a clear error rather than producing a message the
  device would reject.
- **Durable nonce.** The original `recentBlockhash` is reused verbatim and never
  refreshed, so durable-nonce values are preserved.
