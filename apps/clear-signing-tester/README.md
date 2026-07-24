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

| Variable            | Required                      | Default                             | Description             |
| ------------------- | ----------------------------- | ----------------------------------- | ----------------------- |
| `ETHERSCAN_API_KEY` | For contract commands         | —                                   | Etherscan API key       |
| `GATING_TOKEN`      | For CAL origin-gated features | —                                   | Origin token            |
| `SPECULINHO_URL`    | No                            | `https://speculinho.ledgerlabs.net` | Speculinho operator URL |

## Ethereum CLI

```
Usage: pnpm cs-tester cli [options] [command]

Options:
  --device <device>                Device type (stax, nanox, nanos, nanos+, flex, apex, default: stax)
  --app-eth-version <version>      Ethereum app version (e.g. 1.19.1). Must match a version available in Speculinho.
  --os-version <version>           Device OS version (e.g. 1.4.0). Must match a version available in Speculinho.
                                   The app/OS combination must exist — query available versions with:
                                   curl https://speculinho.ledgerlabs.net/apps | jq '.[] | select(.device == "stax" and .coin_app == "Ethereum")'
  --speculinho-url <url>           Speculinho operator URL (overrides SPECULINHO_URL env var)
  --derivation-path <path>         Derivation path (default: "44'/60'/0'/0/0")
  --erc7730-files <files...>       ERC7730 JSON files to inject for clear signing testing
  --screenshot-folder-path <path>  Save screenshots during transaction signing
  --log-level <level>              Console log level: none, error, warn, info, debug (default: info)
  --log-file <path>                Log output to a file
  --file-log-level <level>         File log level (requires --log-file)

Commands:
  raw-transaction <transaction>    Test a single raw transaction
  raw-file <file>                  Test multiple raw transactions from a JSON file
  typed-data <data>                Test a single typed data object (JSON string)
  typed-data-file <file>           Test multiple typed data objects from a JSON file
  contract [options] <address>     Test a contract
  contract-file [options] <file>   Test multiple contracts from a JSON file
  start-speculos                   Start the Speculos emulator and keep it running (Ctrl+C to stop)
```

### Examples

```bash
# App and OS versions must be a valid combination available in Speculinho.
# Query what's available: curl https://speculinho.ledgerlabs.net/apps | jq '.'
pnpm cs-tester cli \
  --device stax \
  --app-eth-version <eth-version> \
  --os-version <os-version> \
  raw-file ressources/raw-erc20.json

# Override the Speculinho operator URL
pnpm cs-tester cli \
  --device stax \
  --speculinho-url https://my-speculinho.example.com \
  raw-file ressources/raw-erc20.json

# Test typed data
pnpm cs-tester cli typed-data-file ressources/typed-data-example.json

# Test a contract
pnpm cs-tester cli contract 0x9D39A5DE30e57443BfF2A8307A4256c8797A3497

# Test with custom ERC7730 descriptors (e.g. for a contract not yet in CAL)
pnpm cs-tester cli raw-transaction <tx> --erc7730-files ./descriptor.json
```

### Pre-built test cases

```bash
pnpm cs-tester test:raw:complete
pnpm cs-tester test:raw:multisig
pnpm cs-tester test:raw:erc20
pnpm cs-tester test:typed-data:multisig
```

## Solana CLI

```
Usage: pnpm cs-tester sol [options] [command]

Options:
  --device <device>                Device type (stax, nanox, nanos, nanos+, flex, apex, default: stax)
  --app-sol-version <version>      Solana app version. Must match a version available in Speculinho.
  --os-version <version>           Device OS version. Must match a version available in Speculinho.
  --speculinho-url <url>           Speculinho operator URL (overrides SPECULINHO_URL env var)
  --derivation-path <path>         Derivation path (default: "44'/501'/0'")
  --screenshot-folder-path <path>  Save screenshots during transaction signing
  --rpc-url <url>                  Solana RPC endpoint (required for program commands)
  --scan-limit <n>                 Number of recent signatures to scan (default: 500)
  --samples-per-instruction <n>    Transactions to test per instruction type (default: 1)
  --log-level <level>              Console log level (default: info)
  --log-file <path>                Log output to a file
  --file-log-level <level>         File log level (requires --log-file)
```

## Finding valid app/OS versions

Speculinho only has specific app/OS combinations available. Passing an unknown combination will fail with a `FileNotFoundError` from the pod. Query the available versions first:

```bash
# All available entries
curl https://speculinho.ledgerlabs.net/apps | jq '.'

# Filter by device and coin app
curl https://speculinho.ledgerlabs.net/apps | jq '.[] | select(.device == "stax" and .coin_app == "Ethereum")'
curl https://speculinho.ledgerlabs.net/apps | jq '.[] | select(.device == "flex" and .coin_app == "Solana")'
```

Then pass matching values to `--app-eth-version`/`--app-sol-version` and `--os-version`.

## ERC7730 Clear Signing Support

Inject custom ERC7730 descriptors to test contracts not yet in the production CAL:

```bash
# Single descriptor
pnpm cs-tester cli raw-transaction <tx> --erc7730-files ./descriptor.json

# Multiple descriptors
pnpm cs-tester cli raw-transaction <tx> --erc7730-files ./d1.json ./d2.json

# With typed data
pnpm cs-tester cli typed-data-file ./test-data.json --erc7730-files ./descriptor.json
```

## Logging

```bash
# Verbose console output
pnpm cs-tester cli --log-level debug raw-file ./ressources/raw-erc20.json

# Log to file with debug level
pnpm cs-tester cli --log-file ./output.log --file-log-level debug raw-file ./ressources/raw-erc20.json

# Silent console, verbose file
pnpm cs-tester cli --log-level none --log-file ./debug.log --file-log-level debug raw-file ./ressources/raw-erc20.json
```

## Screenshots

```bash
pnpm cs-tester cli --screenshot-folder-path ./screenshots raw-file ./ressources/raw-erc20.json
```

Screenshots are saved as `screenshot_1.png`, `screenshot_2.png`, etc.

### Contacts (Address Book) Support

Two flows, one command each.

**`contact-file`** checks the Ethereum app's Address Book behaviour: it
registers each contact with `@ledgerhq/device-contacts-kit` and asserts the
review screens. No signing.

```bash
pnpm cs-tester cli --device flex --os-version 1.7.0-rc2 --app-eth-version 1.23.0-dev \
  contact-file ./ressources/contacts/contacts.json
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

**`--address-book`** checks the signing side: it binds an address book to the
signer for the whole run, so any signing command reviews against it.

```bash
pnpm cs-tester cli --device flex --os-version 1.7.0-rc2 --app-eth-version 1.23.0-dev \
  --address-book ./ressources/contacts/address-book.json \
  raw-file ./ressources/contacts/sign-with-contact.json
```

The proofs in an address-book file are device-issued and seed-bound. `contact-file`
logs the ones it gets back, which is how `address-book.json` was produced; re-record
them if the device or seed changes. `address-book-rejected.json` carries a flipped
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
the Speculos session, so every later case fails as `DeviceSessionNotFound`. Run
with `--device flex --os-version 1.7.0-rc2 --app-eth-version 1.23.0-dev`. The
Address Book HMACs are OS syscalls, so the Speculos image must be recent enough
to implement them.

These three flows run on pull requests via the `contacts-cs-tester` job, gated on
changes to `signer-eth`, `device-contacts-kit` or this app. The job inherits the
firmware pin from the scripts above; it depends on the Speculos image the shared
CI action pulls, which is not pinned per job.

## Output

### Exit codes

- **`0`**: All tests passed
- **Non-zero**: Number of failed tests

### Status types

- **✅ `clear_signed`**: Transaction/typed data was clear signed – all expected texts found on screen
- **⚠️ `partially_clear_signed`**: Signed successfully but at least one expected text was not visible
- **🙈 `blind_signed`**: Signed with blind signing (clear signing not available)
- **❌ `error`**: Operation failed (device communication failure, parsing error, timeout, etc.)
