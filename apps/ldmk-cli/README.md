# Ledger Device Management Kit CLI (ldmk-cli)

An interactive command-line interface for the Ledger Device Management Kit (DMK) using `@ledgerhq/device-transport-kit-node-hid` transport kit. This tool allows you to discover, connect to, and interact with Ledger devices directly from your terminal.

## Overview

The `ldmk-cli` provides a user-friendly way to:

- **Discover and connect** to Ledger devices via USB HID
- **Send raw APDUs** for low-level device communication
- **Execute predefined commands** (get OS version, list apps, battery status, etc.)
- **Perform device actions** (open apps, go to dashboard, get device metadata)
- **Use signers** for cryptographic operations (Ethereum signing supported)

## Getting Started

### Prerequisites

- Node.js 
- pnpm 
- A Ledger device connected via USB

### Installation

From the monorepo root:

```bash
pnpm install
```

### Running the CLI

```bash
pnpm cli dev
```

This starts the DevTools server in the background and launches the interactive CLI.

## Available Commands

The CLI dynamically shows commands based on your connection state.

### When Disconnected

| Command   | Description                    |
| --------- | ------------------------------ |
| `version` | Display the DMK version        |
| `connect` | Connect to a Ledger device     |
| `exit`    | Exit the CLI                   |

### When Connected

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `sendApdu`            | Send raw APDU commands to the device     |
| `sendCommand`         | Execute predefined device commands       |
| `executeDeviceAction` | Perform device actions                   |
| `useSigner`           | Use cryptographic signers                |
| `disconnect`          | Disconnect from the device               |

### Predefined Commands (`sendCommand`)

- Get OS version
- Get app and version
- Get battery status
- List installed apps
- Open app
- Close app

### Device Actions (`executeDeviceAction`)

- Get device status
- Go to dashboard
- Open application
- List installed apps
- Get device metadata (firmware, installed apps, available updates)

### Signer Operations (`useSigner`)

Currently supports Ethereum signing:

- Get Ethereum address
- Verify Safe address
- Sign personal message
- Sign transaction
- Sign typed data (EIP-712)
- Sign delegation authorization

## Project Structure

```
apps/ldmk-cli/
├── handlers/           # Command handlers (Connect, SendApdu, UseSigner, etc.)
├── services/           # Core services (DMK instance, device discovery)
├── state/              # Application state management
├── utils/              # Utilities and constants
├── logger/             # File-based logging implementation
├── index.ts            # Main entry point
└── package.json
```

## Architecture

The CLI is built with:

- **[@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts)** - Interactive terminal prompts
- **[RxJS](https://rxjs.dev/)** - Reactive device discovery and state management
- **[@ledgerhq/device-management-kit](../docs/)** - Core DMK library
- **[@ledgerhq/device-transport-kit-node-hid](../../packages/transport/node-hid/)** - USB HID transport layer
- **[@ledgerhq/device-signer-kit-ethereum](../../packages/signer/signer-eth/)** - Ethereum signing capabilities

## Logging

### File Logger

Logs are written to `var/logs/logs.dev` for debugging purposes. The CLI uses a file-based logger that captures all DMK operations.

### DevTools Integration

The CLI integrates with DMK DevTools for debugging. When running with `pnpm dev`, the DevTools server starts automatically.

## Adding New Commands

1. Create a new handler in `handlers/`
2. Register the command in `utils/Constants.ts`
3. Export the handler from `handlers/index.ts`

