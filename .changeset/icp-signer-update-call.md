---
"@ledgerhq/device-signer-kit-icp": minor
---

Add update-call signing (`signUpdateCall`) for neuron management: signs an IC update call together with its companion read-state request and returns both signatures with the read-state body. Add a `stake` flag to `signTransaction` to sign a neuron-creation transfer.
