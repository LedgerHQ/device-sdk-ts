#!/usr/bin/env zx

require("zx/globals");
const { input, confirm } = require("@inquirer/prompts");
const path = require("path");

async function generateSigner() {
  console.log(chalk.blue("🚀 Welcome to the Ledger Device SDK Signer Generator"));
  console.log(chalk.gray("This will create a new signer package skeleton for your cryptocurrency.\n"));

  try {
    const fs = require("fs");
    const signerDir = "packages/signer";

    // Get cryptocurrency name
    const cryptoName = await input({
      message: "What is the name of your cryptocurrency?",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Cryptocurrency name is required";
        }
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)) {
          return "Cryptocurrency name must start with a letter and contain only letters and numbers";
        }
        // Check if signer already exists
        const kebabCase = value.toLowerCase();
        const targetDir = `packages/signer/signer-${kebabCase}`;
        if (fs.existsSync(targetDir)) {
          return `Signer package already exists: ${targetDir}`;
        }
        return true;
      },
    });

    // Ask about context module usage
    const useContextModule = await confirm({
      message: "Do you want to include the context-module dependency?",
      default: false,
    });

    console.log(chalk.green("\n✅ Generating signer package for"), chalk.bold(cryptoName));
    console.log(chalk.gray("Context module:"), useContextModule ? chalk.green("Yes") : chalk.red("No"));

    // Normalize to PascalCase for class/interface names (first letter uppercase, rest lowercase)
    const pascalCase = cryptoName.charAt(0).toUpperCase() + cryptoName.slice(1).toLowerCase();
    const kebabCase = cryptoName.toLowerCase();
    const baseDir = `packages/signer/signer-${kebabCase}`;
    
    // Check if target directory already exists
    if (fs.existsSync(baseDir)) {
      console.error(chalk.red(`\n❌ Directory already exists: ${baseDir}`));
      console.error(chalk.red("Please remove it first or choose a different cryptocurrency name."));
      process.exit(1);
    }
    
    console.log(chalk.gray("\n📦 Creating directory structure..."));
    
    // Create the directory structure
    const dirs = [
      baseDir,
      `${baseDir}/src`,
      `${baseDir}/src/api`,
      `${baseDir}/src/api/model`,
      `${baseDir}/src/api/app-binder`,
      `${baseDir}/src/internal`,
      `${baseDir}/src/internal/app-binder`,
      `${baseDir}/src/internal/app-binder/di`,
      `${baseDir}/src/internal/app-binder/command`,
      `${baseDir}/src/internal/app-binder/command/utils`,
      `${baseDir}/src/internal/app-binder/device-action`,
      `${baseDir}/src/internal/app-binder/device-action/GetAddress`,
      `${baseDir}/src/internal/app-binder/device-action/SignTransaction`,
      `${baseDir}/src/internal/use-cases`,
      `${baseDir}/src/internal/use-cases/address`,
      `${baseDir}/src/internal/use-cases/address/di`,
      `${baseDir}/src/internal/use-cases/transaction`,
      `${baseDir}/src/internal/use-cases/transaction/di`,
      `${baseDir}/src/internal/use-cases/di`,
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    function writeFile(filePath, content) {
      fs.writeFileSync(filePath, content);
      console.log(chalk.green(`✅ Created ${filePath}`));
    }

    console.log(chalk.gray("\n📦 Generating files..."));
    
    // Generate package.json
    const packageJson = {
      name: `@ledgerhq/device-signer-kit-${kebabCase}`,
      version: "0.1.0",
      private: false,
      license: "Apache-2.0",
      repository: {
        type: "git",
        url: "https://github.com/LedgerHQ/device-sdk-ts.git"
      },
      exports: {
        ".": {
          types: "./lib/types/index.d.ts",
          import: "./lib/esm/index.js",
          require: "./lib/cjs/index.js"
        },
        "./*": {
          types: "./lib/types/*",
          import: "./lib/esm/*",
          require: "./lib/cjs/*"
        }
      },
      files: ["./lib"],
      scripts: {
        prebuild: "rimraf lib",
        build: "pnpm ldmk-tool build --entryPoints src/index.ts,src/**/*.ts --tsconfig tsconfig.prod.json",
        dev: "concurrently \"pnpm watch:builds\" \"pnpm watch:types\"",
        "watch:builds": "pnpm ldmk-tool watch --entryPoints src/index.ts,src/**/*.ts --tsconfig tsconfig.prod.json",
        "watch:types": "concurrently \"tsc --watch -p tsconfig.prod.json\" \"tsc-alias --watch -p tsconfig.prod.json\"",
        lint: "eslint",
        "lint:fix": "pnpm lint --fix",
        prettier: "prettier . --check",
        "prettier:fix": "prettier . --write",
        typecheck: "tsc --noEmit",
        test: "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage"
      },
      dependencies: {
        "@ledgerhq/signer-utils": "workspace:^",
        "inversify": "catalog:",
        "purify-ts": "catalog:",
        "reflect-metadata": "catalog:",
        "xstate": "catalog:"
      },
      devDependencies: {
        "@ledgerhq/device-management-kit": "workspace:^",
        "@ledgerhq/ldmk-tool": "workspace:^",
        "@ledgerhq/eslint-config-dsdk": "workspace:^",
        "@ledgerhq/prettier-config-dsdk": "workspace:^",
        "@ledgerhq/tsconfig-dsdk": "workspace:^",
        "@ledgerhq/vitest-config-dmk": "workspace:^",
        "rxjs": "catalog:",
        "ts-node": "catalog:"
      },
      peerDependencies: {
        "@ledgerhq/device-management-kit": "workspace:^"
      }
    };

    if (useContextModule) {
      packageJson.dependencies["@ledgerhq/context-module"] = "workspace:^";
      packageJson.peerDependencies["@ledgerhq/context-module"] = "workspace:^";
      packageJson.devDependencies["@ledgerhq/context-module"] = "workspace:^";
    }

    writeFile(`${baseDir}/package.json`, JSON.stringify(packageJson, null, 2) + '\n');

    // Generate tsconfig.json
    writeFile(`${baseDir}/tsconfig.json`, `{
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
`);

    // Generate tsconfig.prod.json
    writeFile(`${baseDir}/tsconfig.prod.json`, `{
  "extends": "./tsconfig.json",
  "include": ["src"]
}
`);

    // Generate vitest.config.mjs
    writeFile(`${baseDir}/vitest.config.mjs`, `import { defineConfig } from "vitest/config";
import { vitestConfigDmk } from "@ledgerhq/vitest-config-dmk";

export default defineConfig({
  ...vitestConfigDmk,
  test: {
    ...vitestConfigDmk.test,
    setupFiles: ["./vitest.setup.mjs"],
  },
});
`);

    // Generate vitest.setup.mjs
    writeFile(`${baseDir}/vitest.setup.mjs`, `import "reflect-metadata";
`);

    // Generate .prettierrc.js
    writeFile(`${baseDir}/.prettierrc.js`, `module.exports = require("@ledgerhq/prettier-config-dsdk");
`);

    // Generate .prettierignore
    writeFile(`${baseDir}/.prettierignore`, `lib/
node_modules/
`);

    // Generate eslint.config.mjs
    writeFile(`${baseDir}/eslint.config.mjs`, `import { eslintConfigDmk } from "@ledgerhq/eslint-config-dsdk";

export default eslintConfigDmk;
`);

    // Generate src/index.ts
    writeFile(`${baseDir}/src/index.ts`, `// inversify requirement
import "reflect-metadata";

export * from "@api/index";
`);

    // Generate src/api/index.ts
    writeFile(`${baseDir}/src/api/index.ts`, `export * from "@api/Signer${pascalCase}";
export * from "@api/Signer${pascalCase}Builder";
// Export other types as needed
`);

    // Generate src/api/Signer{pascalCase}.ts
    writeFile(`${baseDir}/src/api/Signer${pascalCase}.ts`, `import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface Signer${pascalCase} {
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
`);

    // Generate src/api/Signer{pascalCase}Builder.ts
    writeFile(`${baseDir}/src/api/Signer${pascalCase}Builder.ts`, `import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSigner${pascalCase} } from "@internal/DefaultSigner${pascalCase}";

type Signer${pascalCase}BuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the \`Signer${pascalCase}\` class.
 */
export class Signer${pascalCase}Builder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: Signer${pascalCase}BuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSigner${pascalCase}({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
`);

    // Generate model files
    writeFile(`${baseDir}/src/api/model/AddressOptions.ts`, `export type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};
`);

    writeFile(`${baseDir}/src/api/model/TransactionOptions.ts`, `export type TransactionOptions = {
  skipOpenApp?: boolean;
  // Add other options as needed
};
`);

    writeFile(`${baseDir}/src/api/model/Signature.ts`, `export type Signature = {
  r: string;
  s: string;
  v?: number;
  // Adjust based on your blockchain's signature format
};
`);

    writeFile(`${baseDir}/src/api/model/PublicKey.ts`, `export type PublicKey = {
  publicKey: Uint8Array;
  chainCode?: Uint8Array;
};
`);

    // Generate app-binder types
    writeFile(`${baseDir}/src/api/app-binder/GetAddressDeviceActionTypes.ts`, `import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type PublicKey } from "@api/model/PublicKey";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type ${pascalCase}ErrorCodes } from "@internal/app-binder/command/utils/${kebabCase}ApplicationErrors";

export enum GetAddressDAStep {
  OPEN_APP = "signer.${kebabCase}.steps.openApp",
  GET_ADDRESS = "signer.${kebabCase}.steps.getAddress",
}

export type GetAddressDAOutput = PublicKey;

export type GetAddressDAInput = {
  readonly derivationPath: string;
  readonly options: AddressOptions;
};

export type GetAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<${pascalCase}ErrorCodes>["error"];

export type GetAddressDAIntermediateValue = {
  step: GetAddressDAStep;
  requiredUserInteraction: UserInteractionRequired;
};

export type GetAddressDAState = DeviceActionState<
  GetAddressDAOutput,
  GetAddressDAInput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;

export type GetAddressDAReturnType =
  ExecuteDeviceActionReturnType<GetAddressDAState>;
`);

    writeFile(`${baseDir}/src/api/app-binder/SignTransactionDeviceActionTypes.ts`, `import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type ${pascalCase}ErrorCodes } from "@internal/app-binder/command/utils/${kebabCase}ApplicationErrors";

export enum SignTransactionDAStep {
  OPEN_APP = "signer.${kebabCase}.steps.openApp",
  GET_ADDRESS = "signer.${kebabCase}.steps.getAddress",
  SIGN_TRANSACTION = "signer.${kebabCase}.steps.signTransaction",
}

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly options: TransactionOptions;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<${pascalCase}ErrorCodes>["error"];

export type SignTransactionDAIntermediateValue = {
  address?: string;
  step: SignTransactionDAStep;
  requiredUserInteraction: UserInteractionRequired;
};

export type SignTransactionDAState = DeviceActionState<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;

export type SignTransactionDAReturnType =
  ExecuteDeviceActionReturnType<SignTransactionDAState>;
`);

    // Generate internal files
    writeFile(`${baseDir}/src/internal/externalTypes.ts`, `export const externalTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  ${useContextModule ? 'ContextModule: Symbol.for("ContextModule"),' : '// Add ContextModule if needed\n  // ContextModule: Symbol.for("ContextModule"),'}
} as const;
`);

    writeFile(`${baseDir}/src/internal/DefaultSigner${pascalCase}.ts`, `import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type Signer${pascalCase} } from "@api/Signer${pascalCase}";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { makeContainer } from "@internal/di";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSigner${pascalCase}ConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSigner${pascalCase} implements Signer${pascalCase} {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSigner${pascalCase}ConstructorArgs) {
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
`);

    writeFile(`${baseDir}/src/internal/di.ts`, `import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { addressModuleFactory } from "@internal/use-cases/address/di/addressModule";
import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { externalTypes } from "@internal/externalTypes";
import { transactionModuleFactory } from "@internal/use-cases/transaction/di/transactionModule";

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
`);

    // Generate app-binder files
    writeFile(`${baseDir}/src/internal/app-binder/di/appBinderTypes.ts`, `export const appBinderTypes = {
  AppBinding: Symbol.for("AppBinding"),
} as const;
`);

    writeFile(`${baseDir}/src/internal/app-binder/di/appBinderModule.ts`, `import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ${pascalCase}AppBinder } from "@internal/app-binder/${pascalCase}AppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(${pascalCase}AppBinder);
  });
`);

    writeFile(`${baseDir}/src/internal/app-binder/${pascalCase}AppBinder.ts`, `import {
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
export class ${pascalCase}AppBinder {
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
    options?: import("@api/model/TransactionOptions").TransactionOptions;
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
`);

    // Generate command files
    writeFile(`${baseDir}/src/internal/app-binder/command/utils/${kebabCase}ApplicationErrors.ts`, `export enum ${pascalCase}ErrorCodes {
  // Define your error codes here
  // Example:
  // INVALID_DERIVATION_PATH = 0x6a80,
  // TRANSACTION_PARSING_ERROR = 0x6a81,
}
`);

    writeFile(`${baseDir}/src/internal/app-binder/command/GetAddressCommand.ts`, `import { Command } from "@ledgerhq/device-management-kit";
import { type ${pascalCase}ErrorCodes } from "./utils/${kebabCase}ApplicationErrors";

export type GetAddressCommandArgs = {
  derivationPath: string;
  checkOnDevice: boolean;
};

export type GetAddressCommandResponse = {
  publicKey: Uint8Array;
  chainCode?: Uint8Array;
};

export class GetAddressCommand extends Command<
  GetAddressCommandResponse,
  ${pascalCase}ErrorCodes
> {
  constructor(args: GetAddressCommandArgs) {
    super();
    // TODO: Implement APDU construction based on your blockchain's protocol
    // this.apdu = constructGetAddressAPDU(args);
  }

  // TODO: Implement response parsing
  // parseResponse(response: Uint8Array): GetAddressCommandResponse { ... }
}
`);

    writeFile(`${baseDir}/src/internal/app-binder/command/SignTransactionCommand.ts`, `import { Command } from "@ledgerhq/device-management-kit";
import { type ${pascalCase}ErrorCodes } from "./utils/${kebabCase}ApplicationErrors";

export type SignTransactionCommandArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export type SignTransactionCommandResponse = {
  signature: {
    r: string;
    s: string;
    v?: number;
  };
};

export class SignTransactionCommand extends Command<
  SignTransactionCommandResponse,
  ${pascalCase}ErrorCodes
> {
  constructor(args: SignTransactionCommandArgs) {
    super();
    // TODO: Implement APDU construction based on your blockchain's protocol
    // this.apdu = constructSignTransactionAPDU(args);
  }

  // TODO: Implement response parsing
  // parseResponse(response: Uint8Array): SignTransactionCommandResponse { ... }
}
`);

    // Generate use-case files
    writeFile(`${baseDir}/src/internal/use-cases/address/di/addressTypes.ts`, `export const addressTypes = {
  GetAddressUseCase: Symbol.for("GetAddressUseCase"),
} as const;
`);

    writeFile(`${baseDir}/src/internal/use-cases/address/di/addressModule.ts`, `import { ContainerModule } from "inversify";

import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
  });
`);

    writeFile(`${baseDir}/src/internal/use-cases/address/GetAddressUseCase.ts`, `import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ${pascalCase}AppBinder } from "@internal/app-binder/${pascalCase}AppBinder";

@injectable()
export class GetAddressUseCase {
  private readonly _appBinder: ${pascalCase}AppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ${pascalCase}AppBinder,
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
`);

    writeFile(`${baseDir}/src/internal/use-cases/transaction/di/transactionTypes.ts`, `export const transactionTypes = {
  SignTransactionUseCase: Symbol.for("SignTransactionUseCase"),
} as const;
`);

    writeFile(`${baseDir}/src/internal/use-cases/transaction/di/transactionModule.ts`, `import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
  });
`);

    writeFile(`${baseDir}/src/internal/use-cases/transaction/SignTransactionUseCase.ts`, `import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ${pascalCase}AppBinder } from "@internal/app-binder/${pascalCase}AppBinder";

@injectable()
export class SignTransactionUseCase {
  private readonly _appBinder: ${pascalCase}AppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ${pascalCase}AppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._appBinder.signTransaction({
      derivationPath,
      transaction,
      options,
    });
  }
}
`);

    // Generate device action (simplified version)
    writeFile(`${baseDir}/src/internal/app-binder/device-action/GetAddress/GetAddressDeviceAction.ts`, `// TODO: Implement GetAddressDeviceAction if needed
// This is a placeholder - you may not need a custom device action for GetAddress
// if SendCommandInAppDeviceAction is sufficient
`);

    // Generate SignTransactionDeviceAction placeholder
    writeFile(`${baseDir}/src/internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction.ts`, `import {
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
    // TODO: Implement XState machine for transaction signing flow
    // This typically includes:
    // 1. Opening the app
    // 2. Getting the address
    // 3. Signing the transaction
    // 4. Handling user interactions
    // 
    // See the guide for detailed XState implementation examples
    throw new Error("SignTransactionDeviceAction.makeStateMachine not implemented");
  }

  extractDependencies(internalApi: InternalApi) {
    const getAddress = async (args: { input: import("@internal/app-binder/command/GetAddressCommand").GetAddressCommandArgs }) =>
      internalApi.sendCommand(new GetAddressCommand(args.input));
    
    const signTransaction = async (args: { input: import("@internal/app-binder/command/SignTransactionCommand").SignTransactionCommandArgs }) =>
      internalApi.sendCommand(new SignTransactionCommand(args.input));

    return {
      getAddress,
      signTransaction,
    };
  }
}
`);

    // Generate README.md
    writeFile(`${baseDir}/README.md`, `# Signer ${cryptoName}

This package provides a signer implementation for ${cryptoName}.

## Installation

\`\`\`bash
pnpm add @ledgerhq/device-signer-kit-${kebabCase}
\`\`\`

## Usage

\`\`\`typescript
import { Signer${pascalCase}Builder } from "@ledgerhq/device-signer-kit-${kebabCase}";

const signer = new Signer${pascalCase}Builder({ dmk, sessionId }).build();

// Get address
const address = await signer.getAddress("m/44'/0'/0'/0/0");

// Sign transaction
const signature = await signer.signTransaction(
  "m/44'/0'/0'/0/0",
  transactionBytes
);
\`\`\`

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
\`\`\`
`);

    // Generate CHANGELOG.md
    writeFile(`${baseDir}/CHANGELOG.md`, `# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial signer implementation for ${cryptoName}
`);

    console.log(chalk.green("\n🎉 Signer package generated successfully!"));
    console.log(chalk.gray("\nNext steps:"));
    console.log(chalk.gray("1. Navigate to the generated package:"));
    console.log(chalk.cyan(`   cd packages/signer/signer-${kebabCase}`));
    console.log(chalk.gray("2. Install dependencies:"));
    console.log(chalk.cyan("   pnpm install"));
    console.log(chalk.gray("3. Build the package:"));
    console.log(chalk.cyan("   pnpm build"));
    console.log(chalk.gray(`4. Start developing your ${cryptoName} signer implementation!`));
    console.log(chalk.yellow("\n⚠️  Remember to implement:"));
    console.log(chalk.yellow("   - APDU construction in commands"));
    console.log(chalk.yellow("   - Response parsing in commands"));
    console.log(chalk.yellow("   - Device actions (XState machines)"));
    console.log(chalk.yellow("   - Error codes and handling"));

  } catch (error) {
    if (error.name === "ExitPromptError") {
      console.log(chalk.yellow("\n❌ Generation cancelled by user"));
      process.exit(0);
    } else {
      console.error(chalk.red("\n❌ Error generating signer package:"), error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

module.exports = {
  generateSigner,
};
