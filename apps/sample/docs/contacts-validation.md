# Contacts playground — manual validation matrix

End-to-end validation for the Contacts (Address Book) section of the sample app.
The playground drives the **four** public external-address management methods on
`ContactsManager` (Ledger-account contacts are out of scope). It never calls kit internals (`UseCase`s, `Command`s, `DeviceAction`s,
the app binder). The full address book is persisted to `localStorage` under the
key **`dmk-sample-address-book`** and reloaded on page load.

## Scope

| # | Public method                     | Device operation           | Rotates      |
|---|-----------------------------------|----------------------------|--------------|
| 1 | `registerExternalAddress`         | REGISTER IDENTITY          | issues proofs|
| 2 | `renameContact`                   | EDIT CONTACT NAME (dashboard) | `hmacProof` |
| 3 | `editExternalAddressIdentifier`   | EDIT IDENTIFIER            | `hmacRest`   |
| 4 | `editExternalAddressScope`        | EDIT SCOPE                 | `hmacRest`   |

## Prerequisites

- A **compatible device** with an OS + Ethereum app that support Contacts:
  - Register / Edit Identifier / Edit Scope validated on **Flex, OS 1.7.0-rc2,
    Ethereum 1.23.0-dev**.
  - **Rename** needs the OS `EDIT CONTACT NAME` dashboard command, which ships in
    a later OS RC (~mid-Sept 2025). On older OS it returns `686A` — expected.
- Device connected (USB), unlocked, session selected in the sample app.
- Contacts served by the **Ethereum** embedded app (see `ContactsProvider`).
- Open the sample app → **Contacts** in the left menu.

Each method renders its progress / intermediate states and any error through the
shared `DeviceActionsList` harness — watch that panel while confirming on-device.

## Reset between runs

Use the **Clear** button in the Address book panel (or clear the
`dmk-sample-address-book` key in devtools) to start from an empty book. Use
**Reload** to confirm the book survives a page refresh.

## Sample contacts (no device)

**Load samples** seeds placeholder contacts (idempotent — safe to click twice,
and it won't disturb real device-registered entries). Use it to exercise the
panel rendering, persistence/reload, and the `toProvideContactInput` adapter
without a device. Their proofs are **fabricated**, so the device will reject them
for any real Rename / Edit / Provide operation — validate those flows against
device-registered contacts only.

---

## 1. Register External Address — create a new group

1. Open **Register External Address**. Defaults: `Alice` / `Eth main` /
   identifier `de0b…7bae` / `ethereum` / chainId `1`; leave the *existing group*
   fields empty.
2. Execute. On device: review + approve the new contact.
3. **Expect** output `mode: create` and non-empty `groupHandle`, `hmacProof`,
   `hmacRest`.
4. **Address book panel**: one group `Alice` with one address (`Eth main`,
   `de0b…7bae`).
5. **Reload** → the group persists.

## 1b. Register External Address — link to existing group

1. Re-open **Register External Address**. The *existing group handle* / *hmac
   proof* fields are pre-filled from the latest group.
2. Change `identifier` to a different address; keep the group fields.
3. Execute + approve on device.
4. **Expect** output `mode: link`; `groupHandle` + `hmacProof` **echo unchanged**,
   a fresh `hmacRest`.
5. **Panel**: the same `Alice` group now lists **two** addresses.

## 2. Rename Contact

1. Open **Rename Contact** — pre-filled `previousContactName`, `groupHandle`,
   `hmacProof` from the latest group; `newContactName: Bob`.
2. Execute. On device (dashboard, no app): approve `Alice → Bob`.
3. **Expect** a **new** `hmacProof`; `groupHandle` unchanged.
4. **Panel**: group name is now `Bob`; its addresses (identifier / scope /
   `hmacRest`) are **unchanged**. Only the group name + `hmacProof` changed.
5. *(Old OS)*: expect error `686A` — Rename unsupported on this OS.

## 3. Edit External Address Identifier

1. Open **Edit External Address Identifier** — pre-filled from the latest
   address (`previousIdentifier`, `groupHandle`, group `hmacProof`, address
   `hmacRest`); `newIdentifier: 7099…79c8`.
2. Execute + approve `old → new` address on device.
3. **Expect** a **new** `hmacRest`; `hmacProof` echoes **unchanged**.
4. **Panel**: that address now shows the new identifier + rotated `hmacRest`;
   the group name / `hmacProof` and the *scope* are unchanged.

## 4. Edit External Address Scope

1. Open **Edit External Address Scope** — pre-filled from the latest address
   (`previousScope`, `identifier`, group `hmacProof`, address `hmacRest`);
   `newScope: Eth cold`.
2. Execute + approve `old scope → new scope` on device.
3. **Expect** a **new** `hmacRest`; `hmacProof` echoes **unchanged**.
4. **Panel**: that address shows the new scope + rotated `hmacRest`; its
   identifier, the group name and `hmacProof` are unchanged.

---

## Cross-cutting checks

- **Persist + reload**: after any successful op, **Reload** (and a full page
  refresh) shows the same book — proof material intact.
- **Proof-only updates**: rename touches only group name + `hmacProof`; both
  edits touch only the one address's changed field + `hmacRest`. Nothing else in
  the book mutates.
- **Canonical handle**: an address's `groupHandle` copy always equals its
  group's canonical `groupHandle` (the `toProvideContactInput` adapter throws
  otherwise).
- **Errors surface**: reject on device, or run Rename on an unsupporting OS →
  the error renders in the action panel; the book is left unchanged.
- **No kit internals**: the Contacts UI imports only public types + methods from
  `@ledgerhq/device-contacts-kit`.
