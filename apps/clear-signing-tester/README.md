# Ethereum Clear Signing Tester

This TypeScript application tests Ethereum transactions and typed data using the Ledger Device Management Kit and Signer Kit with Speculos transport.

## Prerequisites

1. **Speculos Simulator**: Make sure Speculos is running on `http://localhost:5000` (or set `--speculos-url` option)
2. **Etherscan API Key**: Required for some features (set `ETHERSCAN_API_KEY` environment variable)
3. **Node.js**: Version 20 or higher
4. **Supported Devices**: Stax (default) or Nano X

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

Alternatively, you can un test cases directly:

```bash
pnpm cs-tester test:raw:complete [options]
pnpm cs-tester test:raw:safe [options]
pnpm cs-tester test:typed-data:safe [options]

```

### Global Options

- `--derivation-path <path>`: Derivation path (default: "44'/60'/0'/0/0")
- `--speculos-url <url>`: Speculos server URL (default: http://localhost:5000)
- `--device <device>`: Device type (stax or nanox, default: stax)
- `--verbose, -v`: Enable verbose output
- `--quiet, -q`: Show only result tables (quiet mode)

### Commands

#### 1. Test Single Raw Transaction

```bash
pnpm cli raw-transaction "0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca"
```

#### 2. Test Multiple Raw Transactions from File

Create a JSON file with raw transactions:

```json
[
    {
        "txHash": "",
        "rawTx": "0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca",
        "description": "USDC transfer transaction"
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
                "name": "Example",
                "version": "1"
            },
            "message": {
                "hello": "world"
            }
        },
        "description": "Simple typed data example"
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

- **`clear_signed`**: Transaction/typed data was clear signed successfully
- **`error`**: Operation failed with an error
- **`rejected`**: User rejected the operation on device
- **`timeout`**: Operation timed out

### Batch Results

For file-based commands, the application displays a summary table showing:

- Total items processed
- Number of successful clear signs
- Number of failures
- Individual test results with descriptions
