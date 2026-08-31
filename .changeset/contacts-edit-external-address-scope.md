---
"@ledgerhq/device-contacts-kit": minor
---

Add `ContactsManager.editExternalAddressScope`: the EDIT SCOPE operation (replace the scope of an existing external-address entry within a contact group, keeping the same contact name and identifier), with a version-guarded device action that opens the app by default, checks the Contacts version requirements, and supports `skipOpenApp`. Rotates only the address-level `hmacRest` and preserves the contact-group `hmacProof`.
