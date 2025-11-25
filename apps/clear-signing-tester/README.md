# Ethereum Clear Signing Tester

This TypeScript CLI application tests Ethereum transactions and typed data using the Ledger Device Management Kit and Signer Kit with Speculos transport. It uses the `@ledgerhq/speculos-device-controller` package for controlling simulated Ledger devices via percentage-based coordinates.

## Prerequisites

### Tools

- **Docker**: Required to run Speculos
- **Speculos Simulator**: Required to emulate a device signer application

You can get it using the command `docker pull ghcr.io/ledgerhq/speculos:latest`

- **Node.js**: Version 20 or higher
- **Coin Apps**: Required to run apps

### Environment variable

- `ETHERSCAN_API_KEY`: Etherscan API key (required for some features)
- `GATING_TOKEN`: Origin token for gated features
- `COIN_APPS_PATH`: Path to the coin apps repository to access app files

## Installation

```bash
# Install dependencies
pnpm install

# Build dependencies
pnpm build:libs
```

## Usage

The CLI provides several commands for testing different types of Ethereum operations:

```bash
Usage: pnpm cs-tester cli [options] [command]

Ethereum Transaction Tester CLI - Clean Architecture Edition

Options:
  -V, --version                  output the version number
  --derivation-path <path>       Derivation path (default: "44'/60'/0'/0/0") (default: "44'/60'/0'/0/0")
  --speculos-url <url>           Speculos server URL (default: http://localhost) (default: "http://localhost")
  --speculos-port <port>         Speculos server port (random port if not provided)
  --device <device>              Device type (stax, nanox, nanos, nanos+, flex, apex, default: stax) (default: "stax")
  --app-eth-version <version>    Ethereum app version (e.g., 1.19.1). If not specified, automatically resolves the latest available version for the device.
  --os-version <version>         Device OS version (e.g., 1.8.1). If not specified, automatically resolves the latest available OS version for the device.
  --plugin <plugin>              Plugin to use (e.g., Paraswap). If not specified, uses no plugin.
  --plugin-version <version>     Plugin version to use. If not specified, automatically resolves the latest available version.
  --verbose, -v                  Enable verbose output (default: false)
  --quiet, -q                    Show only result tables (quiet mode) (default: false)
  -h, --help                     display help for command

Commands:
  raw-transaction <transaction>  Test a single raw transaction
  raw-file <file>                Test multiple raw transactions from a JSON file
  typed-data <data>              Test a single typed data object (JSON string)
  typed-data-file <file>         Test multiple typed data objects from a JSON file
  contract [options] <address>   Test a contract
  help [command]                 display help for command
```

Alternatively, you can run test cases directly:

```bash
pnpm cs-tester test:raw:complete
pnpm cs-tester test:raw:multisig
pnpm cs-tester test:raw:erc20
pnpm cs-tester test:typed-data:multisig
```

### Commands

#### 1. Test Single Raw Transaction

```bash
pnpm cs-tester cli raw-transaction 0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca
```

#### 2. Test Multiple Raw Transactions from File

Create a JSON file with raw transactions:

```json
[
  {
    "txHash": "0x5f5f13a49b282221223235a51cc3cb9fe6356321600310a2b97646bed757b352",
    "rawTx": "0x02f870012b83059f6884ae9f364882520894dfaa75323fb721e5f29d43859390f62cc4b600b8874652436b698acb80c001a0bebdd83d9bc034e4824367e3f1cc0e8b8e4b24871eeba9ef8d36130d25c96129a04608841b2945b0ed090bc3c6fe56aef0077d6a5eb6b3416212fe727e7e2b68e1",
    "description": "Simple ETH transfer",
    "expectedTexts": ["Text 1", "Text 2"]
  }
]
```

Run the test:

```bash
pnpm cs-tester cli raw-file ressources/raw-erc20.json
```

#### 3. Test Single Typed Data

```bash
pnpm cs-tester cli typed-data '{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}'
```

#### 4. Test Multiple Typed Data from File

Create a JSON file with typed data objects:

```json
[
  {
    "data": {
      "domain": {
        "name": "USD Coin",
        "verifyingContract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "chainId": 1,
        "version": "2"
      },
      "primaryType": "Permit",
      "message": {
        "owner": "0x...",
        "spender": "0x...",
        "value": "1000000",
        "nonce": 0,
        "deadline": 1234567890
      }
    },
    "description": "USDC permit signature example"
  }
]
```

Run the test:

```bash
pnpm cs-tester cli typed-data-file ressources/typed-data-example.json
```

#### 5. Test Contract

Test all transactions associated with a specific contract address. The CLI will fetch and test recent transactions for the contract:

```bash
pnpm cs-tester cli contract 0x9D39A5DE30e57443BfF2A8307A4256c8797A3497
```

Options:

- `--chain-id <number>`: Chain id to use (default to 1)
- `--skip-cal`: Skip CAL (Crypto Asset List) filtering and fetch random transactions directly from Etherscan instead of only CAL-registered transactions

### Plugin Support

The tester supports running Ethereum transactions with plugins (e.g., Paraswap, 1inch, etc.). When a plugin is specified, Speculos will run the plugin app with the Ethereum app loaded as a library using the `-l` flag.

#### Using Plugins

```bash
# Test with a specific plugin and version
pnpm cs-tester cli raw-transaction <tx> --plugin Paraswap --plugin-version 5.24.0

# Test with a plugin (automatically resolves latest version)
pnpm cs-tester cli raw-transaction <tx> --plugin Paraswap

# Test with plugin and specific OS/Ethereum app versions
pnpm cs-tester cli raw-transaction <tx> \
  --plugin Paraswap \
  --plugin-version 5.24.0 \
  --app-eth-version 1.19.1 \
  --os-version 1.8.1 \
  --device stax
```

**Important Notes:**

- Both the plugin and Ethereum app must be available in your `COIN_APPS_PATH` directory
- The directory structure should be: `COIN_APPS_PATH/<device>/<os-version>/<app-name>/app_<version>.elf`
- If `--plugin-version` is not specified, the tester will automatically resolve the latest available plugin version
- The plugin and Ethereum app must be compatible with the same OS version

## Output

The application outputs test results to the console and uses exit codes to indicate success/failure:

### Exit Codes

- **`0`**: All tests passed (clear signed successfully)
- **Non-zero**: Number of failed tests

### Status Types

- **✅ `clear_signed`**: Transaction/typed data was clear signed successfully – all expected texts were found on screen
- **⚠️ `partially_clear_signed`**: Transaction was signed successfully but at least one expected text is not visible
- **🙈 `blind_signed`**: Transaction was signed with blind signing (fallback mode when clear signing is not possible)
- **❌ `error`**: Operation failed with an error (e.g., device communication failure, parsing error, timeout)
