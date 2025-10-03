# Ethereum Clear Signing Tester

This TypeScript application tests Ethereum transactions and typed data using the Ledger Device Management Kit and Signer Kit with Speculos transport.

## Prerequisites

1. **Speculos Simulator**: Make sure Speculos is running (or set `--speculos-url` and `--speculos-port` options)
2. **Etherscan API Key**: Required for some features (set `ETHERSCAN_API_KEY` environment variable)
3. **Node.js**: Version 20 or higher
4. **Supported Devices**: Stax (default), Nano X, Nano S, Nano S+, Flex, Apex

## Installation

```bash
# Install dependencies
pnpm install

# Or if you're in the root directory
pnpm install --filter clear-signing-tester
```

## Usage

The CLI provides several commands for testing different types of Ethereum operations:

```bash
pnpm cs-tester cli [options] <command>
```

Alternatively, you can run test cases directly:

```bash
pnpm test:raw:complete
pnpm test:raw:safe
pnpm test:raw:erc20
pnpm test:typed-data:safe
```

### Global Options

- `--derivation-path <path>`: Derivation path (default: "44'/60'/0'/0/0")
- `--speculos-url <url>`: Speculos server URL (default: http://localhost)
- `--speculos-port <port>`: Speculos server port (random port if not provided)
- `--device <device>`: Device type (stax, nanox, nanos, nanos+, flex, apex; default: stax)
- `--verbose, -v`: Enable verbose output
- `--quiet, -q`: Show only result tables (quiet mode)

### Commands

#### 1. Test Single Raw Transaction

```bash
pnpm cli raw-transaction "0x02f870012b83059f6884ae9f364882520894dfaa75323fb721e5f29d43859390f62cc4b600b8874652436b698acb80c001a0bebdd83d9bc034e4824367e3f1cc0e8b8e4b24871eeba9ef8d36130d25c96129a04608841b2945b0ed090bc3c6fe56aef0077d6a5eb6b3416212fe727e7e2b68e1"
```

#### 2. Test Multiple Raw Transactions from File

Create a JSON file with raw transactions:

```json
[
    {
        "txHash": "0x5f5f13a49b282221223235a51cc3cb9fe6356321600310a2b97646bed757b352",
        "rawTx": "0x02f870012b83059f6884ae9f364882520894dfaa75323fb721e5f29d43859390f62cc4b600b8874652436b698acb80c001a0bebdd83d9bc034e4824367e3f1cc0e8b8e4b24871eeba9ef8d36130d25c96129a04608841b2945b0ed090bc3c6fe56aef0077d6a5eb6b3416212fe727e7e2b68e1",
        "description": "Simple ETH transfer"
    }
]
```

Run the test:

```bash
pnpm cli raw-file ressources/raw-complete.json
```

#### 3. Test Single Typed Data

```bash
pnpm cli typed-data '{"domain":{"name":"Example"},"message":{"hello":"world"}}'
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
pnpm cli typed-data-file ressources/typed-data-example.json
```

## Environment Variables

- `ETHERSCAN_API_KEY`: Etherscan API key (required for some features)
- `GATED_TOKEN`: Origin token for gated features (optional, defaults to "test-origin-token")

## Output

The application outputs test results to the console and uses exit codes to indicate success/failure:

### Exit Codes

- **`0`**: All tests passed (clear signed successfully)
- **Non-zero**: Number of failed tests

### Console Output

The application provides different levels of output based on the verbosity flags:

- **Default**: Standard progress information and results
- **Verbose (`-v`)**: Detailed debug information
- **Quiet (`-q`)**: Only essential results and tables

### Status Types

- **`clear_signed`**: Transaction/typed data was clear signed successfully - all expected texts were found on screen
- **`partially_clear_signed`**: Transaction was signed successfully but at least one expected text is not visible
- **`blind_signed`**: Transaction was signed with blind signing (fallback mode when clear signing is not possible)
- **`error`**: Operation failed with an error (e.g., device communication failure, parsing error, timeout)

### Batch Results

For file-based commands, the application displays a summary table showing:

- Total items processed
- Number of successful clear signs
- Number of failures
- Individual test results with descriptions
