---
to: packages/signer/signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>/package.json
---
{
  "name": "@ledgerhq/device-signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>",
  "version": "1.0.0",
  "private": false,
  "license": "Apache-2.0",
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
  "files": [
    "./lib"
  ],
  "scripts": {
    "prebuild": "rimraf lib",
    "build": "pnpm ldmk-tool build --entryPoints src/index.ts,src/**/*.ts --tsconfig tsconfig.prod.json",
    "dev": "concurrently \"pnpm watch:builds\" \"pnpm watch:types\"",
    "watch:builds": "pnpm ldmk-tool watch --entryPoints src/index.ts,src/**/*.ts --tsconfig tsconfig.prod.json",
    "watch:types": "concurrently \"tsc --watch -p tsconfig.prod.json\" \"tsc-alias --watch -p tsconfig.prod.json\"",
    "lint": "eslint",
    "lint:fix": "pnpm lint --fix",
    "postpack": "find . -name '*.tgz' -exec cp {} ../../../dist/ \\; ",
    "prettier": "prettier . --check",
    "prettier:fix": "prettier . --write",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@ledgerhq/signer-utils": "workspace:*",
    "buffer": "catalog:",
    "inversify": "catalog:",
    "purify-ts": "catalog:",
    "reflect-metadata": "catalog:",
    "semver": "catalog:",
    "xstate": "catalog:"<% if (useContextModule) { %>,
    "@ledgerhq/context-module": "workspace:*"<% } %>
  },
  "devDependencies": {
    "@ledgerhq/device-management-kit": "workspace:*",
    "@ledgerhq/eslint-config-dsdk": "workspace:*",
    "@ledgerhq/ldmk-tool": "workspace:*",
    "@ledgerhq/prettier-config-dsdk": "workspace:*",
    "@ledgerhq/tsconfig-dsdk": "workspace:*",
    "@ledgerhq/vitest-config-dmk": "workspace:*",
    "@types/semver": "catalog:",
    "rxjs": "catalog:",
    "ts-node": "catalog:"
  },
  "peerDependencies": {
    "@ledgerhq/device-management-kit": "workspace:*"
  }
}

---
to: packages/signer/signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>/tsconfig.json
---
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

---
to: packages/signer/signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>/src/index.ts
---
// inversify requirement
import "reflect-metadata";

export * from "@api/index";

---
to: packages/signer/signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>/src/api/Signer<%= cryptoName %>.ts
---
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOption";
import { type Transaction } from "@api/model/Transaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface Signer<%= cryptoName %> {
  signTransaction: (
    derivationPath: string,
    transaction: Transaction,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
}

---
to: packages/signer/signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>/src/api/Signer<%= cryptoName %>Builder.ts
---
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSigner<%= cryptoName %> } from "@internal/DefaultSigner<%= cryptoName %>";

type Signer<%= cryptoName %>BuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class Signer<%= cryptoName %>Builder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;

  constructor({
    dmk,
    sessionId,
  }: Signer<%= cryptoName %>BuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  public build() {
    return new DefaultSigner<%= cryptoName %>({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}

---
to: packages/signer/signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>/README.md
---
# @ledgerhq/device-signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>

A Ledger Device SDK signer package for the <%= cryptoName %> cryptocurrency.

## Features

- **Get Address**: Retrieve <%= cryptoName %> addresses from Ledger devices
- **Sign Transaction**: Sign <%= cryptoName %> transactions using Ledger devices

## Installation

```bash
npm install @ledgerhq/device-signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>
```

## Usage

```typescript
import { Signer<%= cryptoName %>Builder } from '@ledgerhq/device-signer-kit-<%= h.changeCase.kebabCase(cryptoName) %>';

// Create a signer instance
const signerBuilder = new Signer<%= cryptoName %>Builder({ dmk, sessionId });
const signer = signerBuilder.build();

// Get an address
const addressResult = await signer.getAddress("44'/60'/0'/0/0", {
  checkOnDevice: true,
  skipOpenApp: false,
});

// Sign a transaction
const signatureResult = await signer.signTransaction(
  "44'/60'/0'/0/0",
  "transaction_data_here",
  {}
);
```

## License

Apache-2.0
