---
"@ledgerhq/device-signer-kit-ethereum": minor
---

Provide matching external contacts before signing on prerelease builds of the Ethereum app: the Contacts support check now compares only the release core, so an app reporting e.g. 1.23.0-rc2 against a 1.23.0 minimum is no longer treated as too old
