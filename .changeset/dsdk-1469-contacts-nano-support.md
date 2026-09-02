---
"@ledgerhq/device-contacts-kit": minor
---

Update the Contacts version requirements: raise the minimum OS versions for Stax, Flex and Apex, raise the minimum Ethereum app version, and add Nano X and Nano SP as supported models (Nano S stays unsupported). Version comparison now ignores prerelease and build tags, so a device on a release candidate of a minimum counts as meeting it. Removes `isContactsSupported`: the OS and app minimums gate different operations and are checked independently, so compose them from `resolveContactsVersionRequirements` and `isVersionAtLeast` instead
