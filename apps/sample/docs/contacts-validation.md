# Contacts playground — manual validation matrix

End-to-end validation for the Contacts (Address Book) section of the sample app.
The **Contacts** page mocks the Ledger Wallet desktop Contacts flows (list +
detail, dialogs, device step) on top of the **four** public external-address
methods of `ContactsManager` (Ledger-account contacts are out of scope). The
**Advanced** mode keeps the raw testers of those four methods. Neither calls kit
internals (`UseCase`s, `Command`s, `DeviceAction`s, the app binder). The whole
address book is persisted to `localStorage` under the key
**`dmk-sample-address-book`** and reloaded on page load.

## Scope

| #   | Public method                   | Device operation              | Rotates       | Page flow                             |
| --- | ------------------------------- | ----------------------------- | ------------- | ------------------------------------- |
| 1   | `registerExternalAddress`       | REGISTER IDENTITY             | issues proofs | Add address                           |
| 2   | `renameContact`                 | EDIT CONTACT NAME (dashboard) | `hmacProof`   | Edit contact (once it has an address) |
| 3   | `editExternalAddressIdentifier` | EDIT IDENTIFIER               | `hmacRest`    | Edit address — address changed        |
| 4   | `editExternalAddressScope`      | EDIT SCOPE                    | `hmacRest`    | Edit address — name changed           |

As in Ledger Wallet, adding a contact, renaming a contact that has no address
yet, and deleting contacts or addresses are **local only** (no device). A
contact gets its `groupHandle` + `hmacProof` when its first address is
registered. Editing both the address and its name runs EDIT IDENTIFIER, then
EDIT SCOPE with the rotated `hmacRest` (the device step shows "Step 1 of 2").

## Prerequisites

- A **compatible device** with an OS + app that support Contacts:
  - Register / Edit Identifier / Edit Scope validated on **Flex, OS 1.7.0-rc2,
    Ethereum 1.23.0-dev**.
  - **Rename** needs the OS `EDIT CONTACT NAME` dashboard command; on an OS that
    lacks it the device step shows "Ledger OS update required" or an error.
- For Tron (section 5): **app-tron ≥ 0.8.0** (test provider **P4**).
- **Solana** (section 7): **Solana app ≥ 1.19.0** (`MIN_SOLANA_APP_VERSION`).
  On an older app the device step ends with **"App update required"**.
- Open the sample app → **Contacts** in the left menu. The page works without a
  device; the device step asks for one ("Ledger device required") and starts on
  its own once a device is connected.
- The network picked in **Add address** decides the app: EVM networks →
  Ethereum (with that network's chainId), Tron → Tron, Solana → Solana. Rename
  runs on the dashboard, whatever the family.

## Reset between runs

Use **Reset** in the page header (or clear the `dmk-sample-address-book` key in
devtools) to start from an empty book. **Reload** re-reads the book from storage.

## Sample contacts (no device)

**Load samples** seeds placeholder contacts — Alice (2 Ethereum addresses) and
Bob (1 Ethereum + 1 Solana address). It is idempotent and never disturbs real
device-registered entries. Their proofs are **fabricated**, so the device will
reject them for any real Rename / Edit / Provide operation — validate those
flows against device-registered contacts only. **Device data (sample only)** in
the contact detail shows the stored proof material.

Local flows (add / rename / delete a contact, delete an address, search, name
and address validation, the no-device state) are covered by
`playwright/cases/contacts/contacts-page.spec.ts`.

---

## 1. Add address — first address creates the contact on the device

1. **Add contact** → `Alice`. **Expect** it listed with "0 address" and the
   "Not on a device yet" tag.
2. **Add address** → **Ethereum** → address `0xde0b…7bae`, name `Eth main` →
   **Continue to review**.
3. On device: review + approve the new contact.
4. **Expect** the dialog to close; Alice lists one address under **Ethereum**;
   the tag is gone; **Device data** shows `groupHandle`, `hmacProof` and one
   `hmacRest`.
5. Refresh the page → the contact persists.

## 1b. Add address — next addresses link to the contact

1. On Alice: **Add address** → **Ethereum** → a different address, name
   `Eth cold`. Approve on device.
2. **Expect** two addresses; `groupHandle` + `hmacProof` **unchanged** in
   Device data, a fresh `hmacRest` for the new address.

## 2. Edit contact (rename)

1. On Alice: **Edit contact** (pen icon) → `Bob` → **Apply changes** (Ledger
   logo = device step).
2. On device (dashboard, no app): approve `Alice → Bob`.
3. **Expect** the name `Bob` and a **new** `hmacProof`; `groupHandle` and the
   addresses (identifier / name / `hmacRest`) are **unchanged**.

## 3. Edit address — address

1. Open an address → **Edit** → change the address only → **Apply changes**.
2. Approve `old → new` address on device.
3. **Expect** the new address and a **new** `hmacRest`; the name and the
   contact's `hmacProof` are unchanged.

## 4. Edit address — name, then both

1. **Edit** → change the name only → approve. **Expect** the new name and a new
   `hmacRest`; identifier and `hmacProof` unchanged.
2. **Edit** → change the address **and** the name → the device step runs
   "Step 1 of 2 · Edit address" then "Step 2 of 2 · Edit address name"; approve
   both. **Expect** both changes and one final `hmacRest`.

## 5. Tron — register, then clear-sign a transfer

1. **Add address** → **Tron** → a base58 `T…` address (a 21-byte `41…` hex also
   works). The Tron app opens — approve.
2. **Expect** the address under **Tron**, shown in base58.
3. Build an unsigned TRX transfer (`TransferContract`) to that address — e.g.
   TronGrid Shasta/Nile `wallet/createtransaction` → `raw_data_hex`.
4. Open **Signers → Tron** → **Sign transaction** with that hex. The signer is
   rebuilt automatically whenever the book changes — no reload needed.
5. **Expect** the device review to show the contact name + address name instead
   of the raw address.
6. **TRC20**: a `transfer(address,uint256)` (or `approve`) of a known TRC20
   token (e.g. USDT) to the registered address also shows the contact name —
   the signer matches the token recipient, as the Tron app does, not the token
   contract.
7. **Negative**: an unregistered recipient shows the raw address; app-tron
   < 0.8.0 or a Nano S skips the contact step.

## 6. Ethereum — clear-sign a transfer to a contact

1. Register an Ethereum contact (section 1) on the network you will sign on.
2. Open **Signers → Ethereum** → **Sign transaction** with an unsigned native
   transfer whose `to` is that address and whose chainId matches. The signer is
   rebuilt automatically whenever the book changes — no reload needed.
3. **Expect** the device review to show the contact name + address name.
4. **Negative**: a different chainId, an unregistered `to`, or Ethereum app
   < 1.23.0 shows the raw address. An ERC-20 `transfer` recipient (in calldata)
   is not matched by the Ethereum signer by design — only the transaction `to`.

## 7. Solana — address entry and the version gate

1. **Add address** → **Solana**. **Expect** the "Solana support" note.
2. Enter a base58 wallet public key (32 bytes; `0x`-prefixed hex also works).
   A short or non-base58 value shows "Incorrect address format.".
3. **Continue to review** → the Solana app opens → **expect "App update
   required"** (kit version gate), with the `ContactsVersionRequirementError`
   in **Error details**. The book is left unchanged. Without the Solana app
   installed, the open-app failure shows instead (Unknown error + details).
4. Once a Solana app supports Contacts and the gate is lifted, run sections 1–4
   on Solana, then sign on **Signers → Solana**: the book's Solana contacts are
   injected into the signer (`withAddressBook`, rebuilt whenever the book
   changes). A SOL transfer — or an SPL `TransferChecked` to the contact's
   associated token account — to a registered wallet should show the contact
   name. The signer gates the step behind its own `contacts` feature (Solana app
   ≥ 1.19.0); **Settings → Solana disabled features → Contacts** turns it off.

---

## Device step — expected screens

| Situation                                        | Screen                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- |
| No device session                                | Ledger device required + connect buttons                        |
| Opening the app / sending                        | Preparing your Ledger device                                    |
| Device locked                                    | Power on and unlock your {device}                               |
| Waiting for the user                             | Continue on your {device}                                       |
| Rejected on device (`0x6a80`, dashboard refusal) | Operation rejected on Ledger device — **Retry** reruns the step |
| Proof from another seed (`0x6982`)               | Use the same Ledger device you used to add this contact         |
| Invalid data (`0x6984`, kit validation)          | This address can't be saved                                     |
| App / OS below the Contacts requirement          | App update required / Ledger OS update required (rename)        |
| Anything else                                    | Unknown error                                                   |

Every error screen has **Error details** with the raw kit error. A failed step
leaves the book unchanged.

## Advanced mode

**Advanced** (page header) opens the raw testers of the four methods: every
device field is editable (hex proofs, arbitrary group handles, skip open app)
and the full output is shown. The forms are pre-filled from the latest entries
of the book, and successful outputs are folded into the same book. Use it for
firmware / kit debugging; it needs a device session.

## Cross-cutting checks

- **Persist + reload**: after any successful op, a page refresh shows the same
  book — proof material intact.
- **Proof-only updates**: rename touches only the contact name + `hmacProof`;
  both edits touch only the one address's changed field + `hmacRest`. Nothing
  else in the book mutates.
- **Canonical handle**: an address's `groupHandle` copy always equals its
  contact's canonical `groupHandle` (the `toProvideContactInput` adapter throws
  otherwise).
- **No kit internals**: the Contacts UI imports only public types + methods from
  `@ledgerhq/device-contacts-kit`.
