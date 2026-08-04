---
"@ledgerhq/device-signer-kit-zcash": minor
---

Stream a v6 (ZIP-229 / Ironwood) previous transaction for GET_TRUSTED_INPUT, so a UTXO created by one can be spent: read the fourth Ironwood action count, regroup that bundle per the ZIP-244 txid digest as the Orchard one already was, and leave out every shielded pool's anchor — Sapling included — which v6 moved to the authorizing digest.
