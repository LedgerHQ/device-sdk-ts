---
"@ledgerhq/device-signer-kit-solana": patch
---

fix(signer-solana): populate app_domain in off-chain message header and surface APDU errors in SignOffChainMessageCommand

- Added `appDomain` option to `signMessage()` to allow callers to specify the application domain in the off-chain message header, per the Anza off-chain message signing spec. Defaults to 32 zero bytes for backwards compatibility.
- Added `CommandErrorHelper` to `SignOffChainMessageCommand.parseResponse()` to properly surface APDU error status words (e.g. 0x6a81 "Invalid off-chain message header"), enabling the existing v0→legacy fallback mechanism to trigger correctly.
