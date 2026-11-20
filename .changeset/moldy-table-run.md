---
"@ledgerhq/device-signer-kit-solana": patch
---

Remove dead code with no behaviour change. Unused modules and exports that can still be deep-imported are kept and marked `@deprecated`, and will be removed in the next major version. `applyInstructionInfoRule` and `RequirementAccumulator.addInstructionInfo` now do nothing. `DescriptorRequirements.instructionInfos`, `ParsedHideRule.ruleSetIndex` and `TransactionParser.hasAddressLookupTables` are removed.
