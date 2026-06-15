---
"@ledgerhq/device-signer-kit-ethereum": minor
---

Add `SignerEth.editLedgerAccount` to rename a previously-registered Ledger account (Edit Ledger Account, `P1=0x12`). The device re-derives the seed-bound HMAC key at the account's derivation path and rejects the rename with status word `0x6982` — before showing any confirmation — when the account was registered under a different seed. This is mapped to the typed seed-mismatch `ContactsCommandError` ("registered with a different seed") rather than the generic ETH "Security status not satisfied" message.
