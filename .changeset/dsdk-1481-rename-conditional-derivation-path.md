---
"@ledgerhq/device-contacts-kit": patch
---

Fix Rename Contact failing with 0x686A on OS builds that still require the EDIT
CONTACT NAME derivation path (e.g. Flex 1.7.0-rc2). The kit now sends the
`DERIVATION_PATH` (tag 0x69) conditionally, based on the device OS version read
freshly from the device: OS builds below the model's cutoff
(`renameDerivationPathRequiredBelowOsVersion`, e.g. `1.7.0-rc3` for Flex) get the
path they require, while the cutoff build and later (rc3, final, GA) get the
path-free payload they expect — so no build ever receives the wrong shape. The
cutoff lives as data in `ContactsVersionRequirements` and can be removed in one
commit once no in-the-field OS predates it.

Also map 0x686A to an actionable message, and give every address-book command a
sane default for unmapped status words, so a host never receives a bare
`UnknownDeviceExchangeError`.
