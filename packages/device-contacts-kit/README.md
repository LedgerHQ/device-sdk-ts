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

## Registering an external address

`registerExternalAddress` runs the device's REGISTER IDENTITY operation. It opens the embedded app
by default, checks the [Contacts version requirements](#version-requirements), then frames the
request to the device and returns the device-issued proof material for the host to persist.

```ts
const { observable } = contactsManager.registerExternalAddress({
  contactName: "Alice",
  scope: "Eth main",
  identifier: addressBytes, // 20-byte Ethereum address
  blockchainFamily: "ethereum",
  chainId: 1n,
  // existingContactGroup: { groupHandle, hmacProof }, // to extend an existing contact
  // skipOpenApp: true, // skip only the open-app step; the version guard still runs
});

observable.subscribe((state) => {
  // state.intermediateValue.requiredUserInteraction surfaces open-app confirmation
  // and the on-device Register Wallet validation.
  if (state.status === DeviceActionStatus.Completed) {
    const { mode, groupHandle, hmacProof, hmacRest } = state.output;
    // persist mode ("newContactGroup" | "existingContactGroup"), the echoed
    // input, and the proof material.
  }
});
```

## Renaming a contact

`renameContact` runs the device's EDIT CONTACT NAME operation. Unlike the register operations, this
is a blockchain-agnostic **dashboard** command served by the device OS: it always navigates to the
dashboard first (never opens an app), checks only the [minimum OS version](#version-requirements),
then rotates the contact group's name proof. Pass the current name, the new name, the group's
`groupHandle`, and the existing `hmacProof`; the op returns the replacement group-level `hmacProof`
for the host to persist. Per-entry `hmacRest` values are untouched — they never cover the name.

```ts
const { observable } = contactsManager.renameContact({
  previousContactName: "Alice",
  newContactName: "Bob",
  groupHandle, // 64 bytes, from the group's Register Identity
  hmacProof, // 32 bytes, the current name proof
});

observable.subscribe((state) => {
  // state.intermediateValue.requiredUserInteraction surfaces the go-to-dashboard
  // steps and the on-device validation.
  if (state.status === DeviceActionStatus.Completed) {
    const { contactName, groupHandle, hmacProof } = state.output;
    // persist the new name and the replacement hmacProof.
  }
});
```

Concrete Contacts operations (Edit Identifier, Edit Scope, Register Ledger Account, Edit Ledger
Account) are added by their dedicated implementation tickets.

## Version requirements

Contacts APDUs are only supported on some device models, and have minimum embedded-app and device
OS version requirements. The requirements are exposed as plain, serializable data so hosts can
consume them without duplicating the values:

```ts
import {
  CONTACTS_VERSION_REQUIREMENTS,
  ETHEREUM_APP_NAME,
  isVersionAtLeast,
  resolveContactsVersionRequirements,
} from "@ledgerhq/device-contacts-kit";

// Look up the minimum OS / app versions for a device model.
const requirement = resolveContactsVersionRequirements(deviceModelId);
// { supported: true, minOsVersion, minAppVersion: { Ethereum } } | { supported: false }

if (requirement.supported) {
  // OS-owned operations, e.g. renaming a contact from the dashboard.
  const osReady = isVersionAtLeast(osVersion, requirement.minOsVersion);

  // App-owned operations, e.g. registering an external address.
  const minAppVersion = requirement.minAppVersion[ETHEREUM_APP_NAME];
  const appReady =
    minAppVersion !== undefined && isVersionAtLeast(appVersion, minAppVersion);
}
```

The two axes are checked independently, never as one combined verdict: `minOsVersion` gates
OS-owned operations (served by the device OS, e.g. renaming a contact from the dashboard) and
`minAppVersion` gates app-owned operations (served by the embedded app, keyed by app name — v1
ships Ethereum only). A device can satisfy one and not the other, and each Contacts operation
depends on exactly one of them, so collapsing them into a single "is Contacts supported" answer
would reject devices that can serve the operation the host actually wants.

`isVersionAtLeast` and the raw `CONTACTS_VERSION_REQUIREMENTS` table are pure and
dependency-light, so a host such as Ledger Wallet can import either to compose its own
app-readiness checks. Version comparison ignores prerelease and build tags, so a device on a
release candidate of a minimum (`1.7.0-rc2` against a `1.7.0` minimum) counts as meeting it.
