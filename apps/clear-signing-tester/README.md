# Clear Signing Tester

TypeScript CLI that tests Ethereum and Solana transactions using the Ledger Device Management Kit with a [Speculinho](https://ledgerhq.atlassian.net/wiki/spaces/PE/pages/7100399635)-provisioned Speculos emulator.

## How it works

The tester acquires a remote Speculos pod from Speculinho, runs signing tests against it, then releases it. No Docker, no local coin apps required.

## Prerequisites

- **Node.js** 20+

## Installation

```bash
pnpm install
pnpm build:libs
```

## Environment variables

| Variable         | Required                      | Default                             | Description             |
| ---------------- | ----------------------------- | ----------------------------------- | ----------------------- |
| `GATING_TOKEN`   | For CAL origin-gated features | —                                   | Origin token            |
| `SPECULINHO_URL` | No                            | `https://speculinho.ledgerlabs.net` | Speculinho operator URL |

## Running scenarios

Every test is a **scenario**: a device, a coin app, an action, and its input.
Each one is a file under [`ressources/`](./ressources) that describes how to run
itself, so running one is a selection rather than a bespoke command, and adding
one is a new file rather than a code change.

The unit of work is a **case**, not a scenario. Selected fixtures are flattened
to their individual cases and spread over as many emulators as `--concurrency`
allows, each on its own pod, released when the case ends. So an eighteen-case
fixture is eighteen independent tests rather than one long one: `erc7730:1inch`
takes about 73s over six pods instead of roughly four minutes on one. A pod that
dies costs exactly one case rather than every case after it.

Scenarios whose cases depend on each other declare `"mode": "sequential"` and
run whole on one device — `gating:every-10-tx` counts transactions
on the device, and `contacts:register` asserts the first contact is still there
when the second registers. Splitting either would make it pass without testing
anything.

```bash
# everything
pnpm cs-tester cli test all

# one or more groups
pnpm cs-tester cli test erc7730 gating contacts

# a single scenario
pnpm cs-tester cli test core:complete

# what a CI job runs: one device, everything that supports it
pnpm cs-tester cli test all --device stax --concurrency 6

# see what exists
pnpm cs-tester cli test --list
```

A selector is `all`, a group name, or a scenario name. Unknown selectors fail
before any emulator is acquired, and a scenario that does not support the
requested `--device` is skipped rather than failed.

### Groups

| Group                | Devices           | What it covers                                |
| -------------------- | ----------------- | --------------------------------------------- |
| `core`               | stax, nanox       | Ethereum transaction and typed-data fixtures  |
| `contacts`           | flex              | Address Book registration and signing         |
| `gating`             | stax, flex        | Unauthenticated callers fall back to gating   |
| `erc7730`            | stax, nanox, flex | Per-dapp calldata descriptors                 |
| `erc7730-typed-data` | stax, nanox, flex | Per-dapp typed-data descriptors               |
| `solana`             | stax, nanox, flex | Solana transaction fixtures                   |
| `solana-programs`    | stax, nanox, flex | Live program transactions (needs `--rpc-url`) |

### Options

| Option                         | Default          | Description                                        |
| ------------------------------ | ---------------- | -------------------------------------------------- |
| `--device <device>`            | every supported  | Run only scenarios supporting this device          |
| `--concurrency <n>`            | `4`              | How many scenarios may hold an emulator at once    |
| `--list`                       | —                | List every scenario and exit                       |
| `--log-level <level>`          | `info`           | Console log level                                  |
| `--log-dir <path>`             | —                | One log file per scenario                          |
| `--file-log-level <level>`     | `--log-level`    | File log level                                     |
| `--screenshot-folder-path`     | —                | Save signing screenshots                           |
| `--speculinho-url <url>`       | `SPECULINHO_URL` | Speculinho operator URL                            |
| `--speculos-http-timeout <ms>` | `0` (none)       | Timeout for Speculos pod requests                  |
| `--rpc-url <url>`              | —                | Solana RPC, required by `solana-programs`          |
| `--derivation-path <path>`     | `44'/60'/0'/0/0` | Ethereum derivation path                           |
| `--solana-derivation-path`     | `44'/501'/0'`    | Solana derivation path                             |
| `--erc7730-files <files...>`   | —                | Inject descriptors; also switches CAL to test mode |

### Scenario files

A scenario file carries its own metadata and its cases, so the catalog is
whatever `ressources/` holds:

```json
{
  "group": "core",
  "name": "erc20",
  "action": "signTransaction",
  "devices": ["stax", "nanox"],
  "coinApp": "Ethereum",
  "mode": "parallel",
  "cases": [{ "rawTx": "0x02f8b4…", "expectedTexts": ["USDT", "5000"] }]
}
```

The selector is `group:name`, so this file is `core:erc20`. The directory it
sits in is free — `erc7730/uniswap/` holds one scenario of each group.

| Field                     | Required | Meaning                                                                      |
| ------------------------- | -------- | ---------------------------------------------------------------------------- |
| `group`, `name`           | yes      | Selector `group:name`; the group is selectable on its own                    |
| `action`                  | yes      | `signTransaction`, `signTypedData`, `registerContact`, `solanaProgram`       |
| `devices`                 | yes      | Devices this scenario supports; a run picks one                              |
| `coinApp`                 | yes      | `Ethereum` or `Solana`                                                       |
| `cases`                   | yes\*    | The inputs; `solanaProgram` takes none, its input comes from the RPC         |
| `mode`                    | no       | `parallel` (default) or `sequential`                                         |
| `osVersion`, `appVersion` | no       | Override the device's pin, together                                          |
| `options`                 | no       | `blindSigningEnabled`, `skipOriginToken`, `addressBook`, `useRpc`, `distill` |

A file counts as a scenario only once it declares an `action`, so plain data —
an address book, a fixture kept for manual runs — sits alongside untouched. A
malformed scenario file fails the run and the unit tests by name rather than
silently shrinking a selection.

## App and OS versions

Speculinho requires an explicit app and OS version on every run and resolves no
"latest" of its own, so [`default_versions.json`](./default_versions.json) pins the pair each run
asks for, keyed **device > OS > coin app > app version**:

```json
{
  "stax": { "1.10.1": { "Ethereum": "1.22.3", "Solana": "1.16.0" } },
  "flex": { "1.6.1": { "Ethereum": "1.22.3", "Solana": "1.16.0" } }
}
```

The OS is not chosen separately: an app is pinned under exactly one OS per
device, so `--device flex` plus an Ethereum run resolves `1.6.1` and `1.22.3`.
Pin an app under two OS versions for one device and the lookup fails as ambiguous
rather than guessing.

A scenario needing a different pair states it in its own file:

```json
{
  "group": "contacts",
  "name": "sign",
  "osVersion": "1.7.0-rc2",
  "appVersion": "1.23.0-dev"
}
```

That is how the contacts scenarios reach the Address Book pre-release while the
rest of flex Ethereum stays on the released app. Keep the exception on the
scenario — moving it into `default_versions.json` drags every flex Ethereum run
onto the pre-release, which is what once cost the erc7730 typed-data runs three
cases. A unit test fails if a contacts scenario stops pinning its own version,
and another resolves `default_versions.json` for every scenario and device so a
bad edit fails in CI rather than while acquiring a pod.

Resolution order is `--os-version` / `--app-eth-version` / `--app-sol-version`
for a one-off, then the scenario's own pin, then `default_versions.json`. Both CI and a
local run read the same file, so they cannot disagree.

Bump a pin deliberately: the version has to exist **on Speculinho**, which trails
coin-apps by up to about an hour after a release. Speculinho exposes no endpoint
listing what it holds, so the only way to check a candidate is to acquire a pod
with it — an unavailable version fails with `FileNotFoundError` from the pod.

## ERC7730 Clear Signing Support

Inject custom ERC7730 descriptors to test contracts not yet in the production CAL:

```bash
# One descriptor, against a single scenario
pnpm cs-tester cli test erc7730:aave --erc7730-files ./descriptor.json

# Several descriptors
pnpm cs-tester cli test erc7730 --erc7730-files ./d1.json ./d2.json
```

## Logging

```bash
# Verbose console output
pnpm cs-tester cli test core --log-level debug

# One log file per scenario, at debug level
pnpm cs-tester cli test all --log-dir /tmp/logs --file-log-level debug

# Silent console, verbose files
pnpm cs-tester cli test all --log-level none --log-dir /tmp/logs --file-log-level debug
```

## Screenshots

```bash
pnpm cs-tester cli test core:erc20 --screenshot-folder-path ./screenshots
```

Screenshots are saved as `screenshot_1.png`, `screenshot_2.png`, etc.

### Contacts (Address Book) Support

Two flows, both in the `contacts` group.

**`contacts:register`** checks the Ethereum app's Address Book behaviour: it
registers each contact with `@ledgerhq/device-contacts-kit` and asserts the
review screens. No signing.

```bash
pnpm cs-tester cli test contacts:register
```

```json
[
  {
    "description": "Registering an external address shows the contact name for review",
    "contactName": "Alice",
    "scope": "Ethereum",
    "address": "0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4",
    "chainId": "1",
    "expectedTexts": ["Review contact details", "Alice"]
  }
]
```

**`contacts:sign`** checks the signing side: the scenario names an address book,
which is bound to the signer when it is built, so the review resolves the
recipient to a contact name.

```bash
pnpm cs-tester cli test contacts:sign
```

The proofs in an address-book file are device-issued and seed-bound.
`contacts:register` logs the ones it gets back, which is how `address-book.json`
was produced; re-record them if the pinned device identity or the seed changes. `address-book-rejected.json` carries a flipped
group handle, so the device answers `0x6982` and the transaction signs against the
raw address — the guard that a bad book never costs a signature.

`chainId` is a decimal string or number, since JSON has no bigint.
`unexpectedTexts` asserts a text is **absent**; the negative cases need it, because
"the raw address renders" only means something alongside "the contact name does
not". It works on any signing case, not just contacts ones.

#### Case isolation

The Ethereum app caches provided contacts in RAM for the whole app session, so a
name provided by one case stays resolvable for every later case in the same run.
Give each case its own recipient address; do not reuse one across cases.

#### Requirements

Contacts need an RC firmware pair — the newest _stable_ Ethereum app answers
`6e00 "CLA not supported"` to the first address-book APDU, and that also drops
the Speculos session, so every later case fails as `DeviceSessionNotFound`. The
three contacts scenario files carry that pair themselves, so a contacts run
only needs `--device flex`. The Address Book HMACs are OS syscalls
that 1.6.1 does not implement, which is why the OS pin matters as much as the app
one.

The proofs are also bound to the emulator's user and attestation keys, which
Speculos regenerates on every boot. `SpeculinhoServiceController` pins them so a
recorded address book stays valid across pods; change those pins and the recorded
proofs must be re-recorded.

These three flows run on pull requests via the `contacts-cs-tester` job, gated on
changes to `signer-eth`, `device-contacts-kit` or this app. It passes no versions
of its own, so CI and a local run resolve the same pair from the scenario files.

## Output

### Exit codes

- **`0`**: All tests passed
- **Non-zero**: Number of failed tests

### Status types

- **✅ `clear_signed`**: Transaction/typed data was clear signed – all expected texts found on screen
- **⚠️ `partially_clear_signed`**: Signed successfully but at least one expected text was not visible
- **🙈 `blind_signed`**: Signed with blind signing (clear signing not available)
- **❌ `error`**: Operation failed (device communication failure, parsing error, timeout, etc.)

Clear signing is what every case expects, except one that sets
`"expectBlindSigned": true`. Such a case exists to prove the blind-signing
fallback is still detected, so it passes on `blind_signed` — shown as
`🙈 blind signed (expected)` — and fails if it ever clear-signs or errors.
