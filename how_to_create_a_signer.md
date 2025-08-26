# How to Create a Signer Package

This guide explains how to create a new signer package for a cryptocurrency using the Ledger Device SDK signer generator.

## Overview

The signer generator creates a complete signer package skeleton that includes:
- Complete directory structure
- Configuration files (package.json, tsconfig.json, etc.)
- API layer with proper TypeScript types
- Internal implementation with dependency injection
- Device action for address retrieval
- Documentation (README.md, CHANGELOG.md)

## Prerequisites

1. **Proto Tools**: Make sure you have the required tools installed:
   ```bash
   proto use
   ```

2. **Canton Signer**: The generator uses the Canton signer as a template, so ensure `packages/signer/signer-kit-canton/` exists.

## Using the Generator Command

### Interactive Mode

Run the generator interactively:

```bash
pnpm ldmk-tool generate-signer
```

The command will prompt you for:
1. **Cryptocurrency name**: Enter the name of your cryptocurrency (e.g., "SUI", "Bitcoin", "Ethereum")
2. **Context module usage**: Choose whether to include the `@ledgerhq/context-module` dependency

### Example Session

```bash
$ pnpm ldmk-tool generate-signer

🚀 Generating new signer package
🚀 Welcome to the Ledger Device SDK Signer Generator
This will create a new signer package skeleton for your cryptocurrency.

✔ What is the name of your cryptocurrency? SUI
? Do you want to include the context-module dependency? (y/N) n

✅ Generating signer package for SUI
Context module: No

📦 Creating directory structure...
📦 Copying and adapting files...
✅ Created packages/signer/signer-kit-sui/package.json
✅ Created packages/signer/signer-kit-sui/tsconfig.json
✅ Created packages/signer/signer-kit-sui/src/index.ts
✅ Created packages/signer/signer-kit-sui/src/api/SignerSUI.ts
✅ Created packages/signer/signer-kit-sui/src/api/SignerSUIBuilder.ts
... (more files)

🎉 Signer package generated successfully!

Next steps:
1. Navigate to the generated package:
   cd packages/signer/signer-kit-sui
2. Install dependencies:
   pnpm install
3. Build the package:
   pnpm build
4. Start developing your SUI signer implementation!
```

## Generated Package Structure

The generator creates a complete signer package with the following structure:

```
packages/signer/signer-kit-{cryptocurrency}/
├── package.json                 # Package configuration
├── tsconfig.json               # TypeScript configuration
├── tsconfig.prod.json          # Production TypeScript config
├── eslint.config.mjs           # ESLint configuration
├── vitest.config.mjs           # Vitest configuration
├── vitest.setup.mjs            # Vitest setup
├── .prettierrc.js              # Prettier configuration
├── .prettierignore             # Prettier ignore rules
├── README.md                   # Documentation
├── CHANGELOG.md                # Change log
└── src/
    ├── index.ts                # Main entry point
    ├── api/                    # Public API
    │   ├── Signer{crypto}.ts   # Main signer interface
    │   ├── Signer{crypto}Builder.ts # Signer builder
    │   ├── index.ts            # API exports
    │   ├── model/              # Data models
    │   │   ├── AddressOption.ts
    │   │   ├── Transaction.ts
    │   │   ├── TransactionOptions.ts
    │   │   ├── Signature.ts
    │   │   └── PublicKey.ts
    │   └── app-binder/         # Device action types
    │       ├── GetAddressDeviceActionTypes.ts
    │       └── SignTransactionDeviceActionTypes.ts
    └── internal/               # Internal implementation
        ├── DefaultSigner{crypto}.ts # Default signer implementation
        ├── externalTypes.ts    # External dependency types
        ├── di.ts               # Dependency injection setup
        ├── app-binder/         # App binder implementation
        │   ├── {crypto}AppBinder.ts
        │   ├── di/             # DI configuration
        │   │   ├── appBinderTypes.ts
        │   │   └── appBinderModule.ts
        │   ├── command/        # Device commands
        │   │   ├── GetAddressCommand.ts
        │   │   ├── SignTransactionCommand.ts
        │   │   └── utils/
        │   │       └── {crypto}ApplicationErrors.ts
        │   └── device-action/  # Device actions
        │       └── GetAddress/
        │           └── GetAddressDeviceAction.ts
        └── use-cases/          # Business logic
            ├── address/
            │   └── GetAddressUseCase.ts
            ├── transaction/
            │   └── SignTransactionUseCase.ts
            └── di/             # Use cases DI
                ├── useCasesTypes.ts
                └── useCasesModule.ts
```

## Key Features

### 1. Dependency Injection
The signer uses InversifyJS for dependency injection, making it easy to:
- Mock dependencies for testing
- Swap implementations
- Manage complex dependency graphs

### 2. Device Actions
The signer includes XState-based device actions for:
- **GetAddress**: Retrieve cryptocurrency addresses from Ledger devices
- **SignTransaction**: Sign transactions using Ledger devices

### 3. Type Safety
Full TypeScript support with:
- Strict type checking
- Proper import/export types
- Device action type definitions

### 4. Testing Setup
Ready-to-use testing configuration with:
- Vitest for unit testing
- ESLint for code quality
- Prettier for code formatting

## Next Steps After Generation

### 1. Navigate to the Package
```bash
cd packages/signer/signer-kit-{cryptocurrency}
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Build the Package
```bash
pnpm build
```

### 4. Customize for Your Cryptocurrency

#### Update Transaction Types
Modify `src/api/model/Transaction.ts` to match your cryptocurrency's transaction format:

```typescript
// Example for Bitcoin
export type Transaction = {
  inputs: Array<{
    txid: string;
    vout: number;
    scriptSig: string;
  }>;
  outputs: Array<{
    value: number;
    scriptPubKey: string;
  }>;
  version: number;
  locktime: number;
};
```

#### Implement Cryptocurrency-Specific Commands
Update the command implementations in `src/internal/app-binder/command/`:

```typescript
// Example: GetAddressCommand.ts
export class GetAddressCommand implements Command {
  public readonly id = "GET_ADDRESS";
  
  public serialize(derivationPath: string): Buffer {
    // Implement cryptocurrency-specific serialization
    return Buffer.from(derivationPath, 'utf8');
  }
  
  public deserialize(response: Buffer): string {
    // Implement cryptocurrency-specific deserialization
    return response.toString('utf8');
  }
}
```

#### Add Cryptocurrency-Specific Error Handling
Update `src/internal/app-binder/command/utils/{crypto}ApplicationErrors.ts`:

```typescript
export type {crypto}AppErrorCodes = 
  | "INVALID_DERIVATION_PATH"
  | "INVALID_TRANSACTION_FORMAT"
  | "DEVICE_NOT_CONNECTED"
  | "USER_REJECTED";
```

#### Customize Device Actions
Modify the device actions in `src/internal/app-binder/device-action/` to handle cryptocurrency-specific workflows.

### 5. Test Your Implementation
```bash
pnpm test
```

### 6. Lint and Format
```bash
pnpm lint
pnpm prettier:fix
```

## Available Scripts

The generated package includes several useful scripts:

- `pnpm build` - Build the package
- `pnpm dev` - Start development mode with watch
- `pnpm test` - Run tests
- `pnpm lint` - Run ESLint
- `pnpm prettier:fix` - Format code with Prettier
- `pnpm typecheck` - Run TypeScript type checking

## Context Module Usage

The generator asks whether to include the `@ledgerhq/context-module` dependency. This module provides:

- Context management for device interactions
- Request/response correlation
- Error handling and recovery

**Recommendation**: Include context module for complex signers that need advanced device interaction management.

## Troubleshooting

### Common Issues

1. **Proto Tools Not Found**
   ```bash
   proto use
   ```

2. **Canton Signer Missing**
   Ensure `packages/signer/signer-kit-canton/` exists before running the generator.

3. **Build Errors**
   ```bash
   pnpm install
   pnpm build
   ```

4. **Type Errors**
   ```bash
   pnpm typecheck
   ```

### Getting Help

- Check the generated `README.md` for package-specific information
- Review the Canton signer implementation for reference
- Use the CLI help: `pnpm ldmk-tool help`

## Examples

### SUI Signer
The SUI signer was created using this generator:
```bash
pnpm ldmk-tool generate-signer
# Enter: SUI
# Context module: No
```

### Bitcoin Signer
```bash
pnpm ldmk-tool generate-signer
# Enter: Bitcoin
# Context module: Yes
```

## Contributing

When contributing to the signer generator:

1. Test with different cryptocurrency names
2. Verify the generated package builds successfully
3. Ensure all dependencies are correctly configured
4. Update this documentation if needed

---

**Note**: This generator creates a skeleton that follows Ledger's signer architecture patterns. You'll need to implement cryptocurrency-specific logic for commands, serialization, and error handling.
