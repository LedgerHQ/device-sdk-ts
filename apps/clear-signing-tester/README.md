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
They live in [`src/domain/scenarios/catalog.ts`](./src/domain/scenarios/catalog.ts),
so running one is a selection rather than a bespoke command, and scenarios are
independent — each takes its own emulator, so a run costs about as much wall
clock as its slowest scenario.

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

Adding a scenario is a catalog entry plus a fixture. A unit test asserts every
fixture path exists, so a typo fails fast rather than silently shrinking a run.

## App and OS versions

Speculinho requires an explicit app and OS version on every run and resolves no
"latest" of its own, so [`versions.json`](./versions.json) pins the pair each run
asks for, keyed **device > OS > coin app > app version**:

```json
{
  "stax": { "1.10.1": { "Ethereum": "1.22.3", "Solana": "1.16.0" } },
  "flex": {
    "1.7.0-rc2": { "Ethereum": "1.23.0-dev" },
    "1.6.1": { "Solana": "1.16.0" }
  }
}
```

The OS is not chosen separately: an app is pinned under exactly one OS per
device, so `--device flex` plus an Ethereum run resolves `1.7.0-rc2` and
`1.23.0-dev`. That is deliberate — the Address Book needs the pre-release pair,
and every flex Ethereum run uses it rather than keeping a contacts-only special
case. Pin an app under two OS versions for one device and the lookup fails as
ambiguous rather than guessing.

Both CI and a local run read that file, so they cannot disagree. `--os-version`
and `--app-eth-version`/`--app-sol-version` still override it for a one-off.

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
the Speculos session, so every later case fails as `DeviceSessionNotFound`. That
pair is what [`versions.json`](./versions.json) pins for flex Ethereum, so a
contacts run only needs `--device flex`. The Address Book HMACs are OS syscalls
that 1.6.1 does not implement, which is why the OS pin matters as much as the app
one.

The proofs are also bound to the emulator's user and attestation keys, which
Speculos regenerates on every boot. `SpeculinhoServiceController` pins them so a
recorded address book stays valid across pods; change those pins and the recorded
proofs must be re-recorded.

These three flows run on pull requests via the `contacts-cs-tester` job, gated on
changes to `signer-eth`, `device-contacts-kit` or this app. It resolves versions
through the same `versions.json`, so CI and a local run agree.

## Output

### Exit codes

- **`0`**: All tests passed
- **Non-zero**: Number of failed tests

### Status types

- **✅ `clear_signed`**: Transaction/typed data was clear signed – all expected texts found on screen
- **⚠️ `partially_clear_signed`**: Signed successfully but at least one expected text was not visible
- **🙈 `blind_signed`**: Signed with blind signing (clear signing not available)
- **❌ `error`**: Operation failed (device communication failure, parsing error, timeout, etc.)
