---
"@ledgerhq/device-contacts-kit": minor
---

Add `ContactsManager.registerExternalAddress`: the REGISTER IDENTITY operation (register an external address, either in a new contact group or added to an existing one), with the shared Contacts protocol foundation (TLV serializer, chunked framing, error model, validation) and a version-guarded device action that opens the app by default, checks the Contacts version requirements, and supports `skipOpenApp`
