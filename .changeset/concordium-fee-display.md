---
"@ledgerhq/device-signer-kit-concordium": minor
---

Add on-device fee display for signTransaction. Callers may now pass
`displayFeeMicroCcd` in `TransactionOptions`; when the Concordium app is on
firmware ≥ 5.5.2 the fee (in µCCD) is sent alongside the transaction so the
device can show it to the user before signing. On older firmwares the option
is silently ignored and signing falls back to the legacy APDU flow.
