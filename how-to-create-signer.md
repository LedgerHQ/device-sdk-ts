# How to Create a New Signer

This guide provides a comprehensive overview of the signer packages architecture and step-by-step instructions for creating a new signer implementation.

## Table of Contents

1. [Supporting Packages](#supporting-packages)
2. [Architecture Overview](#architecture-overview)
3. [Step-by-Step Guide (Manual Creation)](#step-by-step-guide-manual-creation)
4. [Key Components Deep Dive](#key-components-deep-dive)
5. [Quick Guide: Creating Device Actions with XState](#quick-guide-creating-device-actions-with-xstate)
6. [Quick Guide: Inversify Dependency Injection](#quick-guide-inversify-dependency-injection)
7. [Testing and Building](#testing-and-building)
8. [Quick Start: Using the Signer Generator](#quick-start-using-the-signer-generator)

---

## Supporting Packages

The Device SDK includes supporting packages that can be used when creating signers:

### 1. **Context Module (`context-module`)**
- **Purpose**: Provides context for clear signing operations
- **Key Features**:
  - Token information
  - NFT information
  - Domain name resolution
  - Transaction verification
  - Safe account verification
- **Note**: Used by signers that need enhanced transaction visibility and clear signing capabilities

### 2. **Signer Utils (`signer-utils`)**
- **Purpose**: Shared utilities across signer packages
- **Key Features**: Common helper functions and utilities

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SignerXxx Interface                      │  │
│  │  (Public API: getAddress, signTransaction, etc.)     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Use Case Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ GetAddress   │  │ SignTransact │  │ SignMessage  │     │
│  │ UseCase      │  │ ionUseCase   │  │ UseCase      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  App Binder Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              XxxAppBinder                            │  │
│  │  (Orchestrates Device Actions)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Device Action Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         XStateDeviceAction (XState Machine)          │  │
│  │  - Manages state transitions                         │  │
│  │  - Handles user interactions                         │  │
│  │  - Orchestrates tasks and commands                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Task & Command Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Tasks      │  │   Commands   │  │   Services   │     │
│  │  (Complex    │  │  (APDU       │  │  (Parsers,   │     │
│  │   Logic)     │  │   Wrappers)  │  │   Mappers)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Device Management Kit (DMK)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Device Communication Layer                    │  │
│  │  (APDU Protocol, Transport, Session Management)      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

1. **Builder Pattern**: `SignerXxxBuilder` for flexible signer construction
2. **Dependency Injection**: Using Inversify for loose coupling
3. **State Machine**: XState for managing complex device action flows
4. **Use Case Pattern**: Business logic encapsulated in use cases
5. **Layered Architecture**: Clear separation between API, business logic, and device communication

---

## Step-by-Step Guide (Manual Creation)

> **Note**: This section provides a detailed manual guide for creating a signer from scratch. If you used the generator (recommended), you can skip to the customization sections or use this as a reference for understanding the architecture.

The following guide walks you through creating a signer package manually, which helps you understand the complete architecture and allows for maximum customization.

### Step 1: Create Package Structure

Create a new directory under `packages/signer/` with the following structure:

```
packages/signer/signer-xxx/
├── src/
│   ├── api/
│   │   ├── app-binder/
│   │   │   ├── [DeviceActionTypes].ts
│   │   │   └── [CommandTypes].ts
│   │   ├── model/
│   │   │   ├── [ModelTypes].ts
│   │   │   └── [Options].ts
│   │   ├── SignerXxx.ts          # Public interface
│   │   ├── SignerXxxBuilder.ts   # Builder class
│   │   └── index.ts              # API exports
│   ├── internal/
│   │   ├── app-binder/
│   │   │   ├── command/
│   │   │   │   └── [CommandClasses].ts
│   │   │   ├── device-action/
│   │   │   │   └── [DeviceActionClasses].ts
│   │   │   ├── task/
│   │   │   │   └── [TaskClasses].ts
│   │   │   ├── di/
│   │   │   │   ├── appBinderModule.ts
│   │   │   │   └── appBinderTypes.ts
│   │   │   └── XxxAppBinder.ts
│   │   ├── [feature-modules]/
│   │   │   ├── di/
│   │   │   │   ├── [feature]Module.ts
│   │   │   │   └── [feature]Types.ts
│   │   │   ├── use-case/
│   │   │   │   └── [UseCase].ts
│   │   │   └── service/
│   │   │       └── [Service].ts
│   │   ├── DefaultSignerXxx.ts   # Implementation
│   │   ├── di.ts                 # DI container setup
│   │   └── externalTypes.ts      # External dependencies types
│   └── index.ts                  # Main entry point
├── package.json
├── tsconfig.json
├── tsconfig.prod.json
├── vitest.config.mjs
├── vitest.setup.mjs
└── README.md
```

### Step 2: Set Up Package Configuration

#### 2.1 Create `package.json`

```json
{
  "name": "@ledgerhq/device-signer-kit-xxx",
  "version": "0.1.0",
  "private": false,
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/LedgerHQ/device-sdk-ts.git"
  },
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "import": "./lib/esm/index.js",
      "require": "./lib/cjs/index.js"
    },
    "./*": {
      "types": "./lib/types/*",
      "import": "./lib/esm/*",
      "require": "./lib/cjs/*"
    }
  },
  "files": ["./lib"],
  "scripts": {
    "prebuild": "rimraf lib",
    "build": "pnpm ldmk-tool build --entryPoints src/index.ts,src/**/*.ts --tsconfig tsconfig.prod.json",
    "dev": "concurrently \"pnpm watch:builds\" \"pnpm watch:types\"",
    "watch:builds": "pnpm ldmk-tool watch --entryPoints src/index.ts,src/**/*.ts --tsconfig tsconfig.prod.json",
    "watch:types": "concurrently \"tsc --watch -p tsconfig.prod.json\" \"tsc-alias --watch -p tsconfig.prod.json\"",
    "lint": "eslint",
    "lint:fix": "pnpm lint --fix",
    "prettier": "prettier . --check",
    "prettier:fix": "prettier . --write",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@ledgerhq/signer-utils": "workspace:^",
    "inversify": "catalog:",
    "purify-ts": "catalog:",
    "reflect-metadata": "catalog:",
    "xstate": "catalog:"
  },
  "devDependencies": {
    "@ledgerhq/device-management-kit": "workspace:^",
    "@ledgerhq/ldmk-tool": "workspace:^",
    "@ledgerhq/eslint-config-dsdk": "workspace:^",
    "@ledgerhq/prettier-config-dsdk": "workspace:^",
    "@ledgerhq/tsconfig-dsdk": "workspace:^",
    "@ledgerhq/vitest-config-dmk": "workspace:^",
    "rxjs": "catalog:",
    "ts-node": "catalog:"
  },
  "peerDependencies": {
    "@ledgerhq/device-management-kit": "workspace:^"
  }
}
```

#### 2.2 Create TypeScript Configuration Files

**`tsconfig.json`**:
```json
{
  "extends": "@ledgerhq/tsconfig-dsdk/tsconfig.sdk",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "./lib/types",
    "module": "ES2022",
    "target": "ES2022",
    "moduleResolution": "bundler",
    "emitDeclarationOnly": true,
    "paths": {
      "@api/*": ["./src/api/*"],
      "@internal/*": ["./src/internal/*"],
      "@root/*": ["./*"]
    },
    "resolveJsonModule": true,
    "types": ["vitest/globals", "node"]
  },
  "include": ["src", "vitest.*.mjs"]
}
```

**`tsconfig.prod.json`**:
```json
{
  "extends": "./tsconfig.json",
  "include": ["src"]
}
```

#### 2.3 Create Vitest Configuration

**`vitest.config.mjs`**:
```javascript
import { defineConfig } from "vitest/config";
import { vitestConfigDmk } from "@ledgerhq/vitest-config-dmk";

export default defineConfig({
  ...vitestConfigDmk,
  test: {
    ...vitestConfigDmk.test,
    setupFiles: ["./vitest.setup.mjs"],
  },
});
```

**`vitest.setup.mjs`**:
```javascript
import "reflect-metadata";
```

### Step 3: Define Public API Interface

#### 3.1 Create `src/api/SignerXxx.ts`

Define the public interface that users will interact with:

```typescript
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerXxx {
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
  
  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  
  // Add other methods as needed
}
```

#### 3.2 Create `src/api/SignerXxxBuilder.ts`

Implement the builder pattern for flexible signer construction:

```typescript
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerXxx } from "@internal/DefaultSignerXxx";

type SignerXxxBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerXxx` class.
 */
export class SignerXxxBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerXxxBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerXxx({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
```

#### 3.3 Create `src/api/index.ts`

Export all public API types and classes:

```typescript
export * from "@api/SignerXxx";
export * from "@api/SignerXxxBuilder";
// Export other types as needed
```

### Step 4: Implement Default Signer

#### 4.1 Create `src/internal/DefaultSignerXxx.ts`

Implement the signer interface using dependency injection:

```typescript
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerXxx } from "@api/SignerXxx";
import { addressTypes } from "@internal/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/address/use-case/GetAddressUseCase";
import { makeContainer } from "@internal/di";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";

type DefaultSignerXxxConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerXxx implements SignerXxx {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerXxxConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  signTransaction(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }
}
```

### Step 5: Set Up Dependency Injection

#### 5.1 Create `src/internal/externalTypes.ts`

Define types for external dependencies:

```typescript
export const externalTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  // Add ContextModule if needed
  // ContextModule: Symbol.for("ContextModule"),
} as const;
```

#### 5.2 Create `src/internal/di.ts`

Set up the Inversify container:

```typescript
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { addressModuleFactory } from "@internal/address/di/addressModule";
import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { externalTypes } from "@internal/externalTypes";
import { transactionModuleFactory } from "@internal/transaction/di/transactionModule";

type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export const makeContainer = ({ dmk, sessionId }: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);

  container.loadSync(
    addressModuleFactory(),
    appBindingModuleFactory(),
    transactionModuleFactory(),
    // Add other modules as needed
  );

  return container;
};
```

### Step 6: Implement Use Cases

#### 6.1 Create Use Case Structure

For each feature (e.g., `address`, `transaction`), create:

**`src/internal/address/di/addressTypes.ts`**:
```typescript
export const addressTypes = {
  GetAddressUseCase: Symbol.for("GetAddressUseCase"),
} as const;
```

**`src/internal/address/di/addressModule.ts`**:
```typescript
import { ContainerModule } from "inversify";

import { addressTypes } from "@internal/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/address/use-case/GetAddressUseCase";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
  });
```

**`src/internal/address/use-case/GetAddressUseCase.ts`**:
```typescript
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { XxxAppBinder } from "@internal/app-binder/XxxAppBinder";

@injectable()
export class GetAddressUseCase {
  private readonly _appBinder: XxxAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: XxxAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._appBinder.getAddress({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
```

### Step 7: Implement App Binder

#### 7.1 Create `src/internal/app-binder/XxxAppBinder.ts`

The app binder orchestrates device actions:

```typescript
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { SignTransactionDeviceAction } from "./device-action/SignTransaction/SignTransactionDeviceAction";
import { SendCommandInAppDeviceAction } from "@ledgerhq/device-management-kit";

@injectable()
export class XxxAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private readonly dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private readonly sessionId: DeviceSessionId,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        command: new GetAddressCommand({
          derivationPath: args.derivationPath,
          checkOnDevice: args.checkOnDevice,
        }),
        skipOpenApp: args.skipOpenApp,
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    transaction: Uint8Array;
    options?: TransactionOptions;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          transaction: args.transaction,
          options: args.options ?? {},
        },
      }),
    });
  }
}
```

#### 7.2 Set Up App Binder DI

**`src/internal/app-binder/di/appBinderTypes.ts`**:
```typescript
export const appBinderTypes = {
  AppBinding: Symbol.for("AppBinding"),
} as const;
```

**`src/internal/app-binder/di/appBinderModule.ts`**:
```typescript
import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { XxxAppBinder } from "@internal/app-binder/XxxAppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(XxxAppBinder);
  });
```

### Step 8: Implement Commands

#### 8.1 Create Command Classes

Commands wrap APDU operations. Example:

**`src/internal/app-binder/command/GetAddressCommand.ts`**:
```typescript
import { Command } from "@ledgerhq/device-management-kit";

export type GetAddressCommandArgs = {
  derivationPath: string;
  checkOnDevice: boolean;
};

export class GetAddressCommand extends Command<
  GetAddressCommandResponse,
  XxxErrorCodes
> {
  constructor(args: GetAddressCommandArgs) {
    super();
    // Implement APDU construction based on your blockchain's protocol
    // this.apdu = constructGetAddressAPDU(args);
  }

  // Implement response parsing
  // parseResponse(response: Uint8Array): GetAddressCommandResponse { ... }
}
```

### Step 9: Implement Device Actions

#### 9.1 Create Device Action Types

**`src/api/app-binder/SignTransactionDeviceActionTypes.ts`**:
```typescript
import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type XxxErrorCodes } from "@internal/app-binder/command/utils/xxxAppErrors";

export enum SignTransactionDAStep {
  OPEN_APP = "signer.xxx.steps.openApp",
  GET_ADDRESS = "signer.xxx.steps.getAddress",
  SIGN_TRANSACTION = "signer.xxx.steps.signTransaction",
}

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly options: TransactionOptions;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<XxxErrorCodes>["error"];

export type SignTransactionDAIntermediateValue = {
  address?: string;
};

export type SignTransactionDAState = DeviceActionState<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;

export type SignTransactionDAReturnType =
  ExecuteDeviceActionReturnType<SignTransactionDAState>;
```

#### 9.2 Create Device Action Implementation

**`src/internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction.ts`**:
```typescript
import {
  type InternalApi,
  XStateDeviceAction,
  type DeviceActionStateMachine,
} from "@ledgerhq/device-management-kit";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";

export class SignTransactionDeviceAction extends XStateDeviceAction<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  Record<string, unknown>
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTransactionDAOutput,
    SignTransactionDAInput,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue,
    Record<string, unknown>
  > {
    // Implement XState machine for transaction signing flow
    // This typically includes:
    // 1. Opening the app
    // 2. Getting the address
    // 3. Signing the transaction
    // 4. Handling user interactions
    
    return createMachine({
      // XState machine configuration
    });
  }

  extractDependencies(internalApi: InternalApi) {
    const getAddress = async (args: { input: GetAddressCommandArgs }) =>
      internalApi.sendCommand(new GetAddressCommand(args.input));
    
    const signTransaction = async (args: { input: SignTransactionCommandArgs }) =>
      internalApi.sendCommand(new SignTransactionCommand(args.input));

    return {
      getAddress,
      signTransaction,
    };
  }
}
```

### Step 10: Create Model Types

#### 10.1 Create Model Files

**`src/api/model/Address.ts`**:
```typescript
export type Address = {
  address: string;
  publicKey?: string;
  chainCode?: string;
};
```

**`src/api/model/AddressOptions.ts`**:
```typescript
export type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};
```

**`src/api/model/TransactionOptions.ts`**:
```typescript
export type TransactionOptions = {
  skipOpenApp?: boolean;
  // Add other options as needed
};
```

**`src/api/model/Signature.ts`**:
```typescript
export type Signature = {
  r: string;
  s: string;
  v?: number;
  // Adjust based on your blockchain's signature format
};
```

### Step 11: Create Main Entry Point

#### 11.1 Create `src/index.ts`

```typescript
// inversify requirement
import "reflect-metadata";

export * from "@api/index";
```

### Step 12: Add to Workspace

#### 12.1 Update `pnpm-workspace.yaml`

Ensure your new package is included in the workspace (it should be automatically included if it's under `packages/signer/`).

### Step 13: Write Tests

#### 13.1 Create Test Files

For each component, create corresponding test files:

- `DefaultSignerXxx.test.ts`
- `SignerXxxBuilder.test.ts`
- `GetAddressUseCase.test.ts`
- `XxxAppBinder.test.ts`
- `[Command].test.ts`
- `[DeviceAction].test.ts`

Example test structure:

```typescript
import { describe, it, expect, vi } from "vitest";
import { DefaultSignerXxx } from "@internal/DefaultSignerXxx";

describe("DefaultSignerXxx", () => {
  it("should get address", async () => {
    // Test implementation
  });
});
```

---

## Key Components Deep Dive

### 1. Builder Pattern

The builder pattern allows flexible signer construction:

```typescript
const signer = new SignerXxxBuilder({ dmk, sessionId })
  .withContextModule(customContextModule) // Optional
  .build();
```

**Benefits**:
- Optional configuration
- Immutable construction
- Clear API

### 2. Dependency Injection (Inversify)

**Why**: Loose coupling, testability, modularity

**Structure**:
- Types defined in `*Types.ts` files
- Modules defined in `*Module.ts` files
- Container setup in `di.ts`

### 3. State Machines (XState)

**Why**: Complex flows with user interactions, error handling, retries

**Components**:
- States: Represent different stages
- Transitions: Define flow between states
- Actions: Side effects (commands, tasks)
- Guards: Conditional transitions

**Example Flow**:
```
OPEN_APP → GET_ADDRESS → SIGN_TRANSACTION → SUCCESS
    ↓           ↓              ↓
  ERROR      ERROR          ERROR
```

---

## Quick Guide: Creating Device Actions with XState

### What is XState?

XState is a library for creating, interpreting, and executing finite state machines and statecharts. In the Device SDK, it's used to manage complex device interaction flows that involve multiple steps, user interactions, error handling, and conditional logic.

### Why Use XState for Device Actions?

1. **Complex Flows**: Device operations often require multiple steps (open app → get config → sign → verify)
2. **User Interactions**: Users need to interact with the device at various points
3. **Error Handling**: Different errors require different recovery strategies
4. **Observability**: State machines provide clear progress tracking
5. **Testability**: State machines are easy to test and visualize

### XState Core Concepts

#### 1. States

States represent different stages of your operation:

```typescript
states: {
  InitialState: { /* ... */ },
  OpenApp: { /* ... */ },
  GetAddress: { /* ... */ },
  SignTransaction: { /* ... */ },
  Success: { /* ... */ },
  Error: { /* ... */ },
}
```

#### 2. Transitions

Transitions define how to move between states:

```typescript
{
  target: "GetAddress",  // Next state
  guard: "noInternalError",  // Condition (optional)
  actions: assign({ /* ... */ }),  // Side effects (optional)
}
```

#### 3. Guards

Guards are conditions that must be true for a transition to occur:

```typescript
guards: {
  noInternalError: ({ context }) => context._internalState.error === null,
  skipOpenApp: ({ context }) => !!context.input.options.skipOpenApp,
}
```

#### 4. Actions

Actions are side effects executed during transitions:

```typescript
actions: {
  assignErrorFromEvent: assign({
    _internalState: (_) => ({
      ..._.context._internalState,
      error: _.event["error"],
    }),
  }),
}
```

#### 5. Actors (Invoked Services)

Actors are async operations (promises, callbacks, other state machines):

```typescript
actors: {
  getAddress: fromPromise(getAddress),
  signTransaction: fromPromise(signTransaction),
  openAppStateMachine: new OpenAppDeviceAction({ /* ... */ })
    .makeStateMachine(internalApi),
}
```

### Creating a Device Action

#### Step 1: Define Types

```typescript
// SignTransactionDeviceActionTypes.ts
export enum SignTransactionDAStep {
  OPEN_APP = "signer.xxx.steps.openApp",
  GET_ADDRESS = "signer.xxx.steps.getAddress",
  SIGN_TRANSACTION = "signer.xxx.steps.signTransaction",
}

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly options: TransactionOptions;
};

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAError = 
  | OpenAppDAError
  | CommandErrorResult<XxxErrorCodes>["error"];

export type SignTransactionDAIntermediateValue = {
  address?: string;
  step: SignTransactionDAStep;
  requiredUserInteraction: UserInteractionRequired;
};

export type SignTransactionDAInternalState = {
  error: SignTransactionDAError | null;
  address: string | null;
  signature: Signature | null;
};
```

#### Step 2: Create Device Action Class

```typescript
import { XStateDeviceAction } from "@ledgerhq/device-management-kit";
import { setup, assign, fromPromise } from "xstate";

export class SignTransactionDeviceAction extends XStateDeviceAction<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  SignTransactionDAInternalState
> {
  makeStateMachine(internalApi: InternalApi) {
    // Extract dependencies (commands, tasks)
    const { getAddress, signTransaction } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as SignTransactionDAInput,
        context: {} as {
          input: SignTransactionDAInput;
          intermediateValue: SignTransactionDAIntermediateValue;
          _internalState: SignTransactionDAInternalState;
        },
        output: {} as SignTransactionDAOutput,
      },
      actors: {
        getAddress: fromPromise(getAddress),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => 
          context._internalState.error === null,
        skipOpenApp: ({ context }) => 
          !!context.input.options.skipOpenApp,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
      },
    }).createMachine({
      id: "SignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          step: SignTransactionDAStep.OPEN_APP,
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          address: null,
          signature: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "GetAddress", guard: "skipOpenApp" },
            { target: "GetAddress" },
          ],
        },
        GetAddress: {
          entry: assign({
            intermediateValue: {
              step: SignTransactionDAStep.GET_ADDRESS,
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            },
          }),
          invoke: {
            id: "getAddress",
            src: "getAddress",
            input: ({ context }) => ({
              input: {
                derivationPath: context.input.derivationPath,
                checkOnDevice: false,
              },
            }),
            onDone: {
              target: "GetAddressResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      address: event.output.data.address,
                    };
                  }
                  return {
                    ...context._internalState,
                    error: event.output.error,
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetAddressResultCheck: {
          always: [
            { target: "SignTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        SignTransaction: {
          entry: assign({
            intermediateValue: {
              step: SignTransactionDAStep.SIGN_TRANSACTION,
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => ({
              input: {
                derivationPath: context.input.derivationPath,
                transaction: context.input.transaction,
              },
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      signature: event.output.data,
                    };
                  }
                  return {
                    ...context._internalState,
                    error: event.output.error,
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTransactionResultCheck: {
          always: [
            { target: "Success", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        Success: {
          type: "final",
          output: ({ context }) => context._internalState.signature!,
        },
        Error: {
          type: "final",
          output: ({ context }) => {
            throw context._internalState.error!;
          },
        },
      },
    });
  }

  extractDependencies(internalApi: InternalApi) {
    const getAddress = async (args: { input: GetAddressCommandArgs }) =>
      internalApi.sendCommand(new GetAddressCommand(args.input));
    
    const signTransaction = async (args: { input: SignTransactionCommandArgs }) =>
      internalApi.sendCommand(new SignTransactionCommand(args.input));

    return { getAddress, signTransaction };
  }
}
```

### Key XState Patterns

#### Pattern 1: Conditional Transitions

```typescript
always: [
  { target: "StateA", guard: "condition1" },
  { target: "StateB", guard: "condition2" },
  { target: "StateC" },  // Default
]
```

#### Pattern 2: Async Operations (Invoke)

```typescript
invoke: {
  id: "operationName",
  src: "actorName",
  input: ({ context }) => ({ /* ... */ }),
  onDone: {
    target: "NextState",
    actions: assign({ /* update context */ }),
  },
  onError: {
    target: "ErrorState",
    actions: "assignErrorFromEvent",
  },
}
```

#### Pattern 3: Entry Actions

```typescript
entry: assign({
  intermediateValue: {
    step: SignTransactionDAStep.SIGN_TRANSACTION,
    requiredUserInteraction: UserInteractionRequired.SignTransaction,
  },
})
```

#### Pattern 4: Nested State Machines

```typescript
actors: {
  openAppStateMachine: new OpenAppDeviceAction({
    input: { appName: "Ethereum" },
  }).makeStateMachine(internalApi),
}
```

### Best Practices

1. **Clear State Names**: Use descriptive names that indicate the operation stage
2. **Error Handling**: Always have error states and proper error propagation
3. **Intermediate Values**: Update `intermediateValue` to track progress for observability
4. **Guards**: Use guards for conditional logic instead of complex state logic
5. **Type Safety**: Leverage TypeScript types for context, input, and output
6. **Testing**: Test each state transition independently

---

## Quick Guide: Inversify Dependency Injection

### What is Inversify?

Inversify is a powerful and lightweight inversion of control (IoC) container for TypeScript and JavaScript applications. It helps manage dependencies and promotes loose coupling between components.

### Why Use Inversify?

1. **Loose Coupling**: Components depend on abstractions, not concrete implementations
2. **Testability**: Easy to mock dependencies in tests
3. **Modularity**: Organize dependencies into modules
4. **Type Safety**: Full TypeScript support
5. **Lifecycle Management**: Control how instances are created and shared

### Core Concepts

#### 1. Container

The container is the central registry for all dependencies:

```typescript
import { Container } from "inversify";

const container = new Container();
```

#### 2. Symbols (Keys)

Symbols are used as unique identifiers for bindings:

```typescript
export const addressTypes = {
  GetAddressUseCase: Symbol.for("GetAddressUseCase"),
} as const;
```

#### 3. Bindings

Bindings define how dependencies are resolved:

```typescript
// Bind to a class (creates new instance each time)
container.bind(MyClass).to(MyClass);

// Bind to a constant value
container.bind(Symbol.for("Config")).toConstantValue({ apiKey: "123" });

// Bind to a singleton (same instance reused)
container.bind(MyClass).to(MyClass).inSingletonScope();
```

#### 4. Modules

Modules group related bindings together:

```typescript
import { ContainerModule } from "inversify";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
  });
```

### Setting Up Dependency Injection

#### Step 1: Define Type Symbols

```typescript
// src/internal/address/di/addressTypes.ts
export const addressTypes = {
  GetAddressUseCase: Symbol.for("GetAddressUseCase"),
} as const;

// src/internal/app-binder/di/appBinderTypes.ts
export const appBinderTypes = {
  AppBinding: Symbol.for("AppBinding"),
} as const;

// src/internal/externalTypes.ts
export const externalTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  ContextModule: Symbol.for("ContextModule"),
} as const;
```

#### Step 2: Create Modules

```typescript
// src/internal/address/di/addressModule.ts
import { ContainerModule } from "inversify";
import { addressTypes } from "./addressTypes";
import { GetAddressUseCase } from "../use-case/GetAddressUseCase";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
  });

// src/internal/app-binder/di/appBinderModule.ts
import { ContainerModule } from "inversify";
import { appBinderTypes } from "./appBinderTypes";
import { XxxAppBinder } from "../XxxAppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(XxxAppBinder);
  });
```

#### Step 3: Set Up Container

```typescript
// src/internal/di.ts
import { Container } from "inversify";
import { addressModuleFactory } from "./address/di/addressModule";
import { appBindingModuleFactory } from "./app-binder/di/appBinderModule";
import { externalTypes } from "./externalTypes";

export const makeContainer = ({ dmk, sessionId, contextModule }) => {
  const container = new Container();

  // Bind external dependencies (from outside the package)
  container.bind(externalTypes.Dmk).toConstantValue(dmk);
  container.bind(externalTypes.SessionId).toConstantValue(sessionId);
  container.bind(externalTypes.ContextModule).toConstantValue(contextModule);

  // Load modules
  container.loadSync(
    addressModuleFactory(),
    appBindingModuleFactory(),
    // ... other modules
  );

  return container;
};
```

#### Step 4: Use Dependency Injection

```typescript
// src/internal/address/use-case/GetAddressUseCase.ts
import { inject, injectable } from "inversify";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { XxxAppBinder } from "@internal/app-binder/XxxAppBinder";

@injectable()  // Mark class as injectable
export class GetAddressUseCase {
  private readonly _appBinder: XxxAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding)  // Inject dependency
    appBinder: XxxAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(derivationPath: string, options?: AddressOptions) {
    return this._appBinder.getAddress({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
    });
  }
}
```

#### Step 5: Resolve Dependencies

```typescript
// src/internal/DefaultSignerXxx.ts
import { Container } from "inversify";
import { addressTypes } from "@internal/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/address/use-case/GetAddressUseCase";

export class DefaultSignerXxx {
  private readonly _container: Container;

  constructor({ dmk, sessionId }) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAddress(derivationPath: string, options?: AddressOptions) {
    // Resolve dependency from container
    const useCase = this._container.get<GetAddressUseCase>(
      addressTypes.GetAddressUseCase
    );
    return useCase.execute(derivationPath, options);
  }
}
```

### Binding Types

#### 1. Class Binding (Default)

Creates a new instance each time:

```typescript
container.bind(MyClass).to(MyClass);
```

#### 2. Singleton Binding

Reuses the same instance:

```typescript
container.bind(MyClass).to(MyClass).inSingletonScope();
```

#### 3. Constant Value Binding

Binds to a specific value:

```typescript
container.bind(Symbol.for("Config")).toConstantValue({ apiKey: "123" });
```

#### 4. Factory Binding

Creates instances using a factory function:

```typescript
container.bind(MyClass).toFactory<MyClass>(() => {
  return () => new MyClass();
});
```

#### 5. Dynamic Value Binding

Resolves value dynamically:

```typescript
container.bind(Symbol.for("CurrentTime")).toDynamicValue(() => {
  return new Date();
});
```

### Advanced Patterns

#### Pattern 1: Interface Binding

```typescript
// Define interface
export interface ITransactionMapper {
  map(transaction: Uint8Array): Transaction;
}

// Bind implementation
container.bind<ITransactionMapper>(
  transactionTypes.TransactionMapperService
).to(EthersTransactionMapperService);
```

#### Pattern 2: Conditional Binding

```typescript
if (process.env.NODE_ENV === "test") {
  container.bind(MyService).to(MockMyService);
} else {
  container.bind(MyService).to(RealMyService);
}
```

#### Pattern 3: Named Bindings

```typescript
container.bind(Symbol.for("Database")).to(PostgresDB).whenTargetNamed("postgres");
container.bind(Symbol.for("Database")).to(MongoDB).whenTargetNamed("mongo");
```

### Testing with Inversify

```typescript
import { Container } from "inversify";
import { describe, it, expect, vi } from "vitest";

describe("GetAddressUseCase", () => {
  it("should get address", () => {
    const container = new Container();
    
    // Create mock
    const mockAppBinder = {
      getAddress: vi.fn().mockResolvedValue({ address: "0x123" }),
    };
    
    // Bind mock
    container.bind(appBinderTypes.AppBinding).toConstantValue(mockAppBinder);
    container.bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
    
    // Resolve and test
    const useCase = container.get<GetAddressUseCase>(
      addressTypes.GetAddressUseCase
    );
    
    const result = await useCase.execute("m/44'/60'/0'/0/0");
    expect(result.address).toBe("0x123");
  });
});
```

### Best Practices

1. **Use Symbols**: Always use Symbols for type identifiers to avoid naming conflicts
2. **Module Organization**: Group related bindings into modules
3. **Factory Functions**: Use factory functions for modules to enable lazy loading
4. **Type Safety**: Leverage TypeScript generics for type-safe resolution
5. **Singleton Scope**: Use singleton scope for stateless services
6. **Constant Values**: Use `toConstantValue` for configuration and external dependencies
7. **Naming Convention**: Use consistent naming (e.g., `*Types.ts`, `*Module.ts`)

### Common Pitfalls

1. **Missing `@injectable()`**: Classes must be decorated with `@injectable()` to be injectable
2. **Circular Dependencies**: Avoid circular dependencies between modules
3. **Missing Bindings**: Ensure all dependencies are bound before resolving
4. **Symbol Conflicts**: Use `Symbol.for()` carefully to avoid conflicts
5. **Import Order**: Import `reflect-metadata` before using decorators

### 4. Commands vs Tasks

**Commands**:
- Single APDU operations
- Direct device communication
- Simple request/response

**Tasks**:
- Complex operations
- Multiple commands
- Business logic
- Context building

### 5. Device Actions

**Purpose**: Orchestrate complete user flows

**Features**:
- State management
- User interaction handling
- Error recovery
- Observable progress

---

## Testing and Building

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### Building

```bash
# Build the package
pnpm build

# Development mode (watch)
pnpm dev
```

### Linting and Formatting

```bash
# Lint
pnpm lint
pnpm lint:fix

# Format
pnpm prettier
pnpm prettier:fix
```

### Type Checking

```bash
pnpm typecheck
```

---

## Best Practices

1. **Follow Existing Patterns**: Study `signer-eth` or `signer-btc` as reference implementations
2. **Type Safety**: Use TypeScript strictly, avoid `any`
3. **Error Handling**: Define clear error types and handle all error cases
4. **User Experience**: Provide clear progress indicators and error messages
5. **Testing**: Aim for high test coverage, especially for critical paths
6. **Documentation**: Document public APIs and complex logic
7. **Modularity**: Keep features in separate modules for maintainability
8. **Observable Behavior**: Use observables for async operations to enable cancellation and progress tracking

---

## Common Patterns

### Pattern 1: Simple Command Flow

```typescript
// Use SendCommandInAppDeviceAction for simple operations
new SendCommandInAppDeviceAction({
  command: new GetAddressCommand({ derivationPath }),
  skipOpenApp: false,
})
```

### Pattern 2: Complex Multi-Step Flow

```typescript
// Use custom XStateDeviceAction for complex flows
new SignTransactionDeviceAction({
  input: { derivationPath, transaction, options },
})
```

### Pattern 3: Context-Aware Operations

```typescript
// If using context module (like Ethereum)
const signer = new SignerXxxBuilder({ dmk, sessionId })
  .withContextModule(contextModule)
  .build();
```

---

## Troubleshooting

### Common Issues

1. **DI Container Errors**: Ensure all modules are loaded in `di.ts`
2. **Type Errors**: Check path aliases in `tsconfig.json`
3. **Build Errors**: Verify `tsconfig.prod.json` extends base config correctly
4. **Test Failures**: Ensure `vitest.setup.mjs` imports `reflect-metadata`

---

## Next Steps

After creating your signer:

1. Write comprehensive tests
2. Create documentation (README.md)
3. Add examples
4. Update main repository documentation
5. Consider adding to the sample app for demonstration

---

## References

- **Device Management Kit**: Core SDK for device communication
- **Context Module**: For clear signing (if applicable)
- **Existing Signers**: Reference implementations
  - `packages/signer/signer-eth/` - Most complex, includes context module
  - `packages/signer/signer-btc/` - Good example of PSBT handling
  - `packages/signer/signer-solana/` - Simpler implementation

---

## Summary

Creating a new signer involves:

1. ✅ Setting up package structure and configuration
2. ✅ Defining public API interface
3. ✅ Implementing default signer with DI
4. ✅ Creating use cases for business logic
5. ✅ Building app binder for device communication
6. ✅ Implementing commands and device actions
7. ✅ Setting up state machines for complex flows
8. ✅ Writing tests and documentation

The architecture follows a layered approach with clear separation of concerns, making it maintainable and testable. Follow the patterns established in existing signers for consistency across the SDK.

---

## Quick Start: Using the Signer Generator

> **Recommended Approach**: The easiest way to create a new signer is using the automated generator tool. It creates a complete signer package skeleton with all necessary files and structure.

### Prerequisites

1. **Proto Tools**: Make sure you have the required tools installed:
   ```bash
   proto use
   ```

2. **No Template Required**: The generator creates signers from scratch following the guide structure. No existing signer template is needed.

### Using the Generator

Run the generator interactively:

```bash
pnpm ldmk-tool generate-signer
```

The command will prompt you for:
1. **Cryptocurrency name**: Enter the name of your cryptocurrency (e.g., "XXX")
2. **Context module usage**: Choose whether to include the `@ledgerhq/context-module` dependency

The generator creates a complete signer package from scratch following the architecture patterns described in this guide.

### Example Session

```bash
$ pnpm ldmk-tool generate-signer

🚀 Generating new signer package
🚀 Welcome to the Ledger Device SDK Signer Generator
This will create a new signer package skeleton for your cryptocurrency.

✔ What is the name of your cryptocurrency? XXX
? Do you want to include the context-module dependency? (y/N) n

✅ Generating signer package for XXX
Context module: No

📦 Creating directory structure...
📦 Copying and adapting files...
✅ Created packages/signer/signer-xxx/package.json
✅ Created packages/signer/signer-xxx/tsconfig.json
✅ Created packages/signer/signer-xxx/src/index.ts
✅ Created packages/signer/signer-xxx/src/api/SignerXXX.ts
✅ Created packages/signer/signer-xxx/src/api/SignerXXXBuilder.ts
... (more files)

🎉 Signer package generated successfully!

Next steps:
1. Navigate to the generated package:
   cd packages/signer/signer-xxx
2. Install dependencies:
   pnpm install
3. Build the package:
   pnpm build
4. Start developing your XXX signer implementation!
```

### Generated Package Structure

The generator creates a complete signer package with the following structure:

```
packages/signer/signer-{cryptocurrency}/
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

### Next Steps After Generation

1. **Navigate to the Package**
   ```bash
   cd packages/signer/signer-{cryptocurrency}
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Build the Package**
   ```bash
   pnpm build
   ```

4. **Customize for Your Cryptocurrency**

   The generator creates a skeleton that follows Ledger's signer architecture patterns. You'll need to implement cryptocurrency-specific logic. See the detailed customization guide in the [Step-by-Step Guide (Manual Creation)](#step-by-step-guide-manual-creation) section for comprehensive instructions.

   Key areas to customize:
   - **Update Transaction Types**: Modify `src/api/model/Transaction.ts` to match your cryptocurrency's transaction format
   - **Implement Commands**: Update command implementations in `src/internal/app-binder/command/`
   - **Add Error Handling**: Update `src/internal/app-binder/command/utils/{crypto}ApplicationErrors.ts`
   - **Customize Device Actions**: Modify device actions in `src/internal/app-binder/device-action/` (see [XState Device Actions Guide](#quick-guide-creating-device-actions-with-xstate))

5. **Test Your Implementation**
   ```bash
   pnpm test
   ```

6. **Lint and Format**
   ```bash
   pnpm lint
   pnpm prettier:fix
   ```

### Context Module Usage

The generator asks whether to include the `@ledgerhq/context-module` dependency. This module provides:

- Context management for device interactions
- Request/response correlation
- Error handling and recovery

**Recommendation**: Include context module for complex signers that need advanced device interaction management (like Ethereum with clear signing).

### Generator Examples

**Example 1 - Simple Signer (without context module)**:
```bash
pnpm ldmk-tool generate-signer
# Enter: XXX
# Context module: No
```

**Example 2 - Complex Signer (with context module)**:
```bash
pnpm ldmk-tool generate-signer
# Enter: XXX
# Context module: Yes
```

### Troubleshooting Generator Issues

1. **Proto Tools Not Found**
   ```bash
   proto use
   ```

2. **Generation Errors**
   If you encounter errors during generation, check that you have write permissions in the `packages/signer/` directory and that the target directory doesn't already exist.

3. **Build Errors**
   ```bash
   pnpm install
   pnpm build
   ```

4. **Type Errors**
   ```bash
   pnpm typecheck
   ```

> **Note**: The generator creates a skeleton that follows Ledger's signer architecture patterns. You'll still need to implement cryptocurrency-specific logic for commands, serialization, and error handling. For a deeper understanding of the architecture and manual customization, refer to the sections above.

