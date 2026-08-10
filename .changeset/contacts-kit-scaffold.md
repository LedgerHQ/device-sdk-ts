---
"@ledgerhq/device-contacts-kit": minor
---

Scaffold the Contacts (Address Book) kit package following the signer-kit public/internal architecture and dependency-injection conventions. Exposes the `ContactsManager` interface and `ContactsManagerBuilder` (receiving `dmk`, `sessionId`, `appName`), with the DI container binding `dmk`, `sessionId`, `appName`, and `ContactsAppBinder`. No concrete Contacts operations yet — those are added by their dedicated tickets.
