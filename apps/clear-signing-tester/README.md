# Ethereum Transaction Testing Script

This TypeScript script tests Ethereum transactions using the Ledger Device Management Kit and Signer Kit with Speculos transport.

## Prerequisites

1. **Speculos Simulator**: Make sure Speculos is running on `http://localhost:5000` (or set `SPECULOS_URL` environment variable)
2. **Etherscan API Key**: Required for dApp testing (set `ETHERSCAN_API_KEY` environment variable)
3. **Node.js**: Version 20 or higher

## Architecture

The script is organized into modular components:

- **`EthereumTransactionTester`**: Main orchestrator for testing transactions
- **`EtherscanService`**: Isolated service for all Etherscan API interactions
- **Configuration files**: JSON files for raw transactions and dApp configurations

## Installation

```bash
# Install dependencies
pnpm install

# Or if you're in the root directory
pnpm install --filter ethereum-transaction-tester
```

## Usage

### Testing Raw Transactions

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
 pnpm eth-tester test:eth --raw examples/raw-transactions.json
```

### Testing dApp Transactions

Create a JSON file with dApp configurations:

```json
[
  {
    "name": "1inch",
    "contracts": [
      "0x111111125421ca6dc452d289314280a0f8842a65"
    ]
  }
]
```

Run the test:

```bash
pnpm eth-tester test:eth --dapps ressources/dapps.json
```

## Environment Variables

- `SPECULOS_URL`: Speculos server URL (default: `http://localhost:5000`)
- `ETHERSCAN_API_KEY`: Etherscan API key (required for dApp testing)

## Output

The script generates timestamped JSON files with test results:

- `raw-transactions-results-{timestamp}.json`
- `dapp-transactions-results-{timestamp}.json`

## Example Output

```json
[
  {
    "index": 1,
    "description": "USDC transfer transaction",
    "status": "success",
    "signature": {
      "r": "0x...",
      "s": "0x...",
      "v": 27
    },
    "error": null,
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  {
    "index": 2,
    "description": "Token approval transaction",
    "status": "success",
    "signature": {
      "status": "timeout",
      "message": "Transaction signing timed out after 5 seconds - accepted by Speculos",
      "timestamp": "2024-01-15T10:30:05.000Z"
    },
    "error": null,
    "timestamp": "2024-01-15T10:30:05.000Z"
  }
]
```

### Status Types

- **`success`**: Transaction was signed successfully OR timed out and was accepted by Speculos
- **`error`**: Transaction signing failed with an error

### Timeout Behavior

When a transaction signing operation times out after 5 seconds, it is considered successful because the Speculos instance has accepted the transaction. This is the expected behavior for clear-signed transactions where no response is returned.

## CI Integration

For CI environments, make sure to:

1. Start Speculos before running tests
2. Set the `ETHERSCAN_API_KEY` environment variable
3. Configure the `SPECULOS_URL` if using a different port

Example CI script:

```yaml
- name: Start Speculos
  run: |
    # Start Speculos in background
    speculos --model nanos --seed "secret" --display headless &
    sleep 5

- name: Test Ethereum Transactions
  run: |
    export ETHERSCAN_API_KEY=${{ secrets.ETHERSCAN_API_KEY }}
    npm run test:eth --raw examples/raw-transactions.json
```

## EtherscanService

The `EtherscanService` class provides a clean interface for all Etherscan API interactions:

### Features

- **Contract Transaction Fetching**: Get the last N transactions for any contract
- **Transaction Validation**: Check if an address is a contract before processing
- **Account Information**: Get balances, transaction counts, and gas prices
- **Error Handling**: Comprehensive error handling with specific error messages
- **Rate Limiting**: Built-in timeout and retry logic

### Usage Example

```typescript
import { EtherscanService } from './services/EtherscanService';

const etherscanService = new EtherscanService({
  apiKey: 'your-api-key',
  timeout: 30000
});

// Fetch contract transactions
const transactions = await etherscanService.getContractTransactions(
  '0x1234567890123456789012345678901234567890',
  10
);

// Check if address is a contract
const isContract = await etherscanService.isContract(
  '0x1234567890123456789012345678901234567890'
);

// Get current gas price
const gasPrice = await etherscanService.getGasPrice();
```

## Troubleshooting

1. **Device not connected**: Ensure Speculos is running and accessible
2. **API errors**: Verify your Etherscan API key is valid
3. **Transaction format errors**: Ensure raw transactions are valid hex strings
4. **Timeout errors**: Increase connection timeout if needed
5. **Rate limiting**: The EtherscanService includes built-in timeout handling 