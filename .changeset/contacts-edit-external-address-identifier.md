---
"@ledgerhq/device-contacts-kit": minor
---

Add `ContactsManager.editExternalAddressIdentifier`: the EDIT IDENTIFIER operation (replace the identifier bytes of an existing external-address entry within a contact group), with a version-guarded device action that opens the app by default, checks the Contacts version requirements, and supports `skipOpenApp`. Rotates only the address-level `hmacRest` and preserves the contact-group `hmacProof`.
