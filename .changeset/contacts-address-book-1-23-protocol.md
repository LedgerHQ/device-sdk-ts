---
"@ledgerhq/device-management-kit": patch
"@ledgerhq/device-signer-kit-ethereum": patch
---

Re-align the Contacts / address-book APDU protocol to Ethereum app 1.23 (the BOLOS SDK address-book feature). The app moved address-book handling into the shared SDK and changed the wire format: the `DERIVATION_PATH` TLV tag is now `0x69` (was `0x21`), and every sub-command uses a uniform chunked transport (2-byte big-endian total-length prefix; `P2` `0x00` for the first/only chunk, `0x80` for continuations). Register External Address, Register Ledger Account and Edit Ledger Account now frame their payloads like the other operations instead of sending a single un-prefixed APDU, and the status-word map gains `0x6984` (unsupported operation) and reframes `0x6b00` as an app-level data rejection. Without this, every address-book operation failed on app-1.23 devices — register was acknowledged with a silent `0x9000` and DMK then threw `InvalidStatusWordError`.
