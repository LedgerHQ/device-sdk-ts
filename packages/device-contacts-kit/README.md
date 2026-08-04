# Device Contacts Kit

`@ledgerhq/device-contacts-kit` is a protocol-level Contacts (Address Book) API for the Ledger
Device Management Kit. It lets any host drive the device's Address Book management operations
(register / edit contacts and Ledger accounts) and obtain the device-issued proof material.

The `ContactsManager` is **stateless**: it only drives device interactions — taking caller input,
running the device operation, and returning the device output (including the `group_handle` and
HMAC proofs). It does **not** store anything, own the address book, or handle persistence. The host
is responsible for persisting and managing the address book.

## Installation

```sh
pnpm add @ledgerhq/device-contacts-kit @ledgerhq/device-management-kit
```

## Usage

```ts
import { ContactsManagerBuilder } from "@ledgerhq/device-contacts-kit";

const contactsManager = new ContactsManagerBuilder({
  dmk,
  sessionId,
  appName,
}).build();
```

Concrete Contacts operations (Register Identity, Edit Contact Name, Edit Identifier, Edit Scope,
Register Ledger Account, Edit Ledger Account) are added by their dedicated implementation tickets.
