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

## Version requirements

Contacts APDUs are only supported on some device models, and have minimum embedded-app and device
OS version requirements. The requirements are exposed as plain, serializable data so hosts can
consume them without duplicating the values:

```ts
import {
  CONTACTS_VERSION_REQUIREMENTS,
  isContactsSupported,
  resolveContactsVersionRequirements,
} from "@ledgerhq/device-contacts-kit";

// Look up the minimum OS / app versions for a device model.
const requirement = resolveContactsVersionRequirements(deviceModelId);
// { supported: true, minOsVersion, minAppVersion: { Ethereum } } | { supported: false }

// Or evaluate support directly.
const supported = isContactsSupported({
  deviceModelId,
  osVersion,
  appName,
  appVersion,
});
```

There are two independent axes: `minOsVersion` gates OS-owned operations (served by the device OS,
e.g. renaming a contact from the dashboard) and `minAppVersion` gates app-owned operations (served
by the embedded app, keyed by app name — v1 ships Ethereum only). The `isContactsSupported` helper
and the raw `CONTACTS_VERSION_REQUIREMENTS` table are pure and dependency-light, so a host such as
Ledger Wallet can import either to compose its own app-readiness checks.
