#!/usr/bin/env zx

require("zx/globals");
const { input, confirm, checkbox } = require("@inquirer/prompts");
const path = require("path");

// ============================================================================
// API Configuration - defines the structure for each available API
// ============================================================================

const API_CONFIGS = {
  getAppConfig: {
    name: "getAppConfig",
    displayName: "getAppConfig - Get app configuration (SendCommandInApp)",
    deviceActionType: "SendCommandInApp",
    useCaseDir: "config",
    useCaseTypesName: "configTypes",
    useCaseClassName: "GetAppConfigUseCase",
    commandClassName: "GetAppConfigCommand",
    userInteraction: "UserInteractionRequired.None",
    userInteractionTypes: "UserInteractionRequired.None",
    hasDerivationPath: false,
    hasOptions: false,
  },
  getAddress: {
    name: "getAddress",
    displayName: "getAddress - Get address from derivation path (SendCommandInApp)",
    deviceActionType: "SendCommandInApp",
    useCaseDir: "address",
    useCaseTypesName: "addressTypes",
    useCaseClassName: "GetAddressUseCase",
    commandClassName: "GetAddressCommand",
    userInteraction: "args.checkOnDevice ? UserInteractionRequired.VerifyAddress : UserInteractionRequired.None",
    userInteractionTypes: "UserInteractionRequired.None | UserInteractionRequired.VerifyAddress",
    hasDerivationPath: true,
    hasOptions: true,
    optionsType: "AddressOptions",
  },
  signTransaction: {
    name: "signTransaction",
    displayName: "signTransaction - Sign a transaction (CallTaskInApp)",
    deviceActionType: "CallTaskInApp",
    useCaseDir: "transaction",
    useCaseTypesName: "transactionTypes",
    useCaseClassName: "SignTransactionUseCase",
    taskClassName: "SignTransactionTask",
    commandClassName: "SignTransactionCommand",
    userInteraction: "UserInteractionRequired.SignTransaction",
    userInteractionTypes: "UserInteractionRequired.SignTransaction",
    hasDerivationPath: true,
    hasOptions: true,
    optionsType: "TransactionOptions",
  },
  signMessage: {
    name: "signMessage",
    displayName: "signMessage - Sign a personal message (SendCommandInApp)",
    deviceActionType: "SendCommandInApp",
    useCaseDir: "message",
    useCaseTypesName: "messageTypes",
    useCaseClassName: "SignMessageUseCase",
    commandClassName: "SignMessageCommand",
    userInteraction: "UserInteractionRequired.SignPersonalMessage",
    userInteractionTypes: "UserInteractionRequired.None | UserInteractionRequired.SignPersonalMessage",
    hasDerivationPath: true,
    hasOptions: false,
  },
};

// ============================================================================
// Helper Functions for Code Generation
// ============================================================================

/**
 * Generates device action types for SendCommandInApp APIs
 */
function generateSendCommandInAppDATypes(config, pascalCase, kebabCase) {
  const pascal = config.name.charAt(0).toUpperCase() + config.name.slice(1);
  const isGetApi = config.name.startsWith("get");
  // Use slice to remove "Get" (3 chars) or "Sign" (4 chars) prefix
  const baseName = isGetApi ? pascal.slice(3) : pascal.slice(4);
  const commandName = isGetApi ? `Get${baseName}` : `Sign${baseName}`;
  
  return `import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ${commandName}CommandResponse } from "@internal/app-binder/command/${commandName}Command";
import { type ${pascalCase}ErrorCodes } from "@internal/app-binder/command/utils/${kebabCase}ApplicationErrors";

type ${pascal}DAUserInteractionRequired =
  | ${config.userInteractionTypes || "UserInteractionRequired.None"};

export type ${pascal}DAOutput =
  SendCommandInAppDAOutput<${commandName}CommandResponse>;

export type ${pascal}DAError =
  | OpenAppDAError
  | CommandErrorResult<${pascalCase}ErrorCodes>["error"];

export type ${pascal}DAIntermediateValue =
  SendCommandInAppDAIntermediateValue<${pascal}DAUserInteractionRequired>;

export type ${pascal}DAReturnType = ExecuteDeviceActionReturnType<
  ${pascal}DAOutput,
  ${pascal}DAError,
  ${pascal}DAIntermediateValue
>;
`;
}

/**
 * Generates device action types for CallTaskInApp APIs
 */
function generateCallTaskInAppDATypes(config, pascalCase, kebabCase) {
  const pascal = config.name.charAt(0).toUpperCase() + config.name.slice(1);
  return `import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type ${pascalCase}ErrorCodes } from "@internal/app-binder/command/utils/${kebabCase}ApplicationErrors";

export type ${pascal}DAOutput = Signature;

export type ${pascal}DAError =
  | OpenAppDAError
  | CommandErrorResult<${pascalCase}ErrorCodes>["error"];

type ${pascal}DARequiredInteraction =
  | OpenAppDARequiredInteraction
  | ${config.userInteraction};

export type ${pascal}DAIntermediateValue = {
  requiredUserInteraction: ${pascal}DARequiredInteraction;
};

export type ${pascal}DAReturnType = ExecuteDeviceActionReturnType<
  ${pascal}DAOutput,
  ${pascal}DAError,
  ${pascal}DAIntermediateValue
>;
`;
}

/**
 * Generates use case DI types file
 */
function generateUseCaseDITypes(config) {
  return `export const ${config.useCaseTypesName} = {
  ${config.useCaseClassName}: Symbol.for("${config.useCaseClassName}"),
} as const;
`;
}

/**
 * Generates use case DI module file
 */
function generateUseCaseDIModule(config) {
  return `import { ContainerModule } from "inversify";

import { ${config.useCaseTypesName} } from "@internal/use-cases/${config.useCaseDir}/di/${config.useCaseTypesName}";
import { ${config.useCaseClassName} } from "@internal/use-cases/${config.useCaseDir}/${config.useCaseClassName}";

export const ${config.useCaseDir}ModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(${config.useCaseTypesName}.${config.useCaseClassName}).to(${config.useCaseClassName});
  });
`;
}

/**
 * Generates a command file with boilerplate implementation
 */
function generateCommand(config, pascalCase, kebabCase) {
  const isGetApi = config.name.startsWith("get");
  const baseName = isGetApi ? config.name.slice(3) : config.name.slice(4); // remove 'get' or 'sign'
  const commandName = isGetApi ? `Get${baseName.charAt(0).toUpperCase() + baseName.slice(1)}` : `Sign${baseName.charAt(0).toUpperCase() + baseName.slice(1)}`;
  
  const argsType = config.commandArgs || null;
  const responseType = config.commandResponse || `{ /* Define response fields */ }`;
  const hasArgs = config.hasDerivationPath || argsType;
  
  const imports = `import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";
${config.name === "signMessage" ? '\nimport { type Signature } from "@api/model/Signature";' : ''}
import { type ${pascalCase}ErrorCodes } from "./utils/${kebabCase}ApplicationErrors";`;

  const argsTypeDefinition = hasArgs ? generateCommandArgsType(config) : '';
  const responseTypeDefinition = generateCommandResponseType(config);
  
  const constructorAndArgs = hasArgs ? `
  private readonly args: ${commandName}CommandArgs;

  constructor(args: ${commandName}CommandArgs) {
    this.args = args;
  }` : '';

  const implementsType = hasArgs 
    ? `Command<${commandName}CommandResponse, ${commandName}CommandArgs, ${pascalCase}ErrorCodes>`
    : `Command<${commandName}CommandResponse, void, ${pascalCase}ErrorCodes>`;

  return `${imports}

${argsTypeDefinition}${responseTypeDefinition}
export class ${commandName}Command
  implements
    ${implementsType}
{
  readonly name = "${commandName}";
${constructorAndArgs}

  getApdu(): Apdu {
    // TODO: Implement APDU construction based on your blockchain's protocol
    // Example structure:
    // const builder = new ApduBuilder({ cla: 0xe0, ins: 0x02, p1: 0x00, p2: 0x00 });
    // Add derivation path and other data to builder
    // return builder.build();
    throw new Error("${commandName}Command.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<${commandName}CommandResponse, ${pascalCase}ErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("${commandName}Command.parseResponse() not implemented");
  }
}
`;
}

function generateCommandArgsType(config) {
  switch (config.name) {
    case "getAddress":
      return `export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

`;
    case "signTransaction":
      return `export type SignTransactionCommandArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

`;
    case "signMessage":
      return `export type SignMessageCommandArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

`;
    default:
      return '';
  }
}

function generateCommandResponseType(config) {
  switch (config.name) {
    case "getAppConfig":
      return `export type GetAppConfigCommandResponse = {
  // Define your app configuration response fields here
  // Example:
  // version: string;
  // flags: number;
};
`;
    case "getAddress":
      return `export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly chainCode?: Uint8Array;
};
`;
    case "signTransaction":
      return `export type SignTransactionCommandResponse = {
  signature: {
    r: string;
    s: string;
    v?: number;
  };
};
`;
    case "signMessage":
      return `export type SignMessageCommandResponse = Signature;
`;
    default:
      return `export type ${config.commandClassName}Response = {
  // Define response fields
};
`;
  }
}

/**
 * Generates a use case class file
 */
function generateUseCase(config, pascalCase) {
  const isGetApi = config.name.startsWith("get");
  const baseName = isGetApi ? config.name.slice(3) : config.name.slice(4);
  const pascal = config.name.charAt(0).toUpperCase() + config.name.slice(1);
  
  const imports = [`import { inject, injectable } from "inversify";`,
    ``,
    `import { type ${pascal}DAReturnType } from "@api/app-binder/${pascal}DeviceActionTypes";`];
  
  if (config.optionsType) {
    imports.push(`import { type ${config.optionsType} } from "@api/model/${config.optionsType}";`);
  }
  imports.push(`import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";`);
  imports.push(`import { ${pascalCase}AppBinder } from "@internal/app-binder/${pascalCase}AppBinder";`);

  const executeParams = generateUseCaseExecuteParams(config);
  const appBinderCall = generateAppBinderCall(config);

  return `${imports.join("\n")}

@injectable()
export class ${config.useCaseClassName} {
  private readonly _appBinder: ${pascalCase}AppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ${pascalCase}AppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(${executeParams}): ${pascal}DAReturnType {
    return this._appBinder.${config.name}(${appBinderCall});
  }
}
`;
}

function generateUseCaseExecuteParams(config) {
  const params = [];
  if (config.hasDerivationPath) {
    params.push("derivationPath: string");
  }
  if (config.name === "signTransaction") {
    params.push("transaction: Uint8Array");
  }
  if (config.name === "signMessage") {
    params.push("message: string | Uint8Array");
  }
  if (config.optionsType) {
    params.push(`options?: ${config.optionsType}`);
  }
  return params.length > 0 ? `\n    ${params.join(",\n    ")},\n  ` : "";
}

function generateAppBinderCall(config) {
  if (config.name === "getAppConfig") {
    return `{
      skipOpenApp: false,
    }`;
  }
  if (config.name === "getAddress") {
    return `{
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    }`;
  }
  if (config.name === "signTransaction") {
    return `{
      derivationPath,
      transaction,
      skipOpenApp: options?.skipOpenApp,
    }`;
  }
  if (config.name === "signMessage") {
    return `{
      derivationPath,
      message,
      skipOpenApp: false,
    }`;
  }
  return "{}";
}

/**
 * Generates device action placeholder comment
 */
function generateDeviceActionPlaceholder(config) {
  const deviceActionType = config.deviceActionType === "CallTaskInApp" 
    ? "CallTaskInAppDeviceAction" 
    : "SendCommandInAppDeviceAction";
  const taskOrCommand = config.taskClassName 
    ? `${config.taskClassName}` 
    : `${config.commandClassName}`;
  
  return `// TODO: Implement ${config.useCaseClassName.replace("UseCase", "")}DeviceAction if needed
// This is a placeholder - you may not need a custom device action for ${config.name}
// if ${deviceActionType}${config.taskClassName ? ` with ${taskOrCommand}` : ''} is sufficient
`;
}

/**
 * Generates a task file for CallTaskInApp APIs
 */
function generateTask(config, pascalCase, kebabCase) {
  const pascal = config.name.charAt(0).toUpperCase() + config.name.slice(1);
  const baseName = pascal.replace("sign", "");
  
  return `import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { ${config.commandClassName} } from "@internal/app-binder/command/${config.commandClassName}";
import { type ${pascalCase}ErrorCodes } from "@internal/app-binder/command/utils/${kebabCase}ApplicationErrors";

type ${config.taskClassName}Args = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class ${config.taskClassName} {
  constructor(
    private api: InternalApi,
    private args: ${config.taskClassName}Args,
  ) {}

  async run(): Promise<CommandResult<Signature, ${pascalCase}ErrorCodes>> {
    // TODO: Adapt this implementation to your blockchain's signing protocol
    // For transactions larger than a single APDU, you may need to:
    // 1. Split the transaction into chunks
    // 2. Send each chunk with appropriate first/continue flags
    // 3. Collect the final signature from the last response

    const result = await this.api.sendCommand(
      new ${config.commandClassName}({
        derivationPath: this.args.derivationPath,
        transaction: this.args.transaction,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    return CommandResultFactory({
      data: result.data.signature,
    });
  }
}
`;
}

// ============================================================================
// Main Generator Function
// ============================================================================

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

    // Ask which APIs to include
    const selectedApis = await checkbox({
      message: "Which APIs do you want to include?",
      choices: [
        { name: "getAppConfig - Get app configuration (SendCommandInApp)", value: "getAppConfig", checked: true },
        { name: "getAddress - Get address from derivation path (SendCommandInApp)", value: "getAddress", checked: true },
        { name: "signTransaction - Sign a transaction (CallTaskInApp)", value: "signTransaction", checked: true },
        { name: "signMessage - Sign a personal message (SendCommandInApp)", value: "signMessage", checked: true },
      ],
      validate: (value) => {
        if (value.length === 0) {
          return "You must select at least one API";
        }
        return true;
      },
    });

    const includeGetAppConfig = selectedApis.includes("getAppConfig");
    const includeGetAddress = selectedApis.includes("getAddress");
    const includeSignTransaction = selectedApis.includes("signTransaction");
    const includeSignMessage = selectedApis.includes("signMessage");

    // Ask about context module usage
    const useContextModule = await confirm({
      message: "Do you want to include the context-module dependency?",
      default: false,
    });

    console.log(chalk.green("\n✅ Generating signer package for"), chalk.bold(cryptoName));
    console.log(chalk.gray("APIs:"), selectedApis.join(", "));
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
      `${baseDir}/src/internal/use-cases`,
      `${baseDir}/src/internal/use-cases/di`,
    ];

    // Add conditional directories based on selected APIs
    if (includeGetAddress) {
      dirs.push(`${baseDir}/src/internal/app-binder/device-action`);
      dirs.push(`${baseDir}/src/internal/app-binder/device-action/GetAddress`);
      dirs.push(`${baseDir}/src/internal/use-cases/address`);
      dirs.push(`${baseDir}/src/internal/use-cases/address/di`);
    }
    if (includeSignTransaction) {
      dirs.push(`${baseDir}/src/internal/app-binder/device-action`);
      dirs.push(`${baseDir}/src/internal/app-binder/device-action/SignTransaction`);
      dirs.push(`${baseDir}/src/internal/app-binder/task`);
      dirs.push(`${baseDir}/src/internal/use-cases/transaction`);
      dirs.push(`${baseDir}/src/internal/use-cases/transaction/di`);
    }
    if (includeSignMessage) {
      dirs.push(`${baseDir}/src/internal/app-binder/device-action`);
      dirs.push(`${baseDir}/src/internal/app-binder/device-action/SignMessage`);
      dirs.push(`${baseDir}/src/internal/use-cases/message`);
      dirs.push(`${baseDir}/src/internal/use-cases/message/di`);
    }
    if (includeGetAppConfig) {
      dirs.push(`${baseDir}/src/internal/app-binder/device-action`);
      dirs.push(`${baseDir}/src/internal/app-binder/device-action/GetAppConfig`);
      dirs.push(`${baseDir}/src/internal/use-cases/config`);
      dirs.push(`${baseDir}/src/internal/use-cases/config/di`);
    }

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

    // Generate src/api/Signer{pascalCase}.ts - dynamic based on selected APIs
    const signerImports = [];
    const signerMethods = [];

    if (includeGetAppConfig) {
      signerImports.push(`import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";`);
      signerMethods.push(`  getAppConfig: () => GetAppConfigDAReturnType;`);
    }
    if (includeGetAddress) {
      signerImports.push(`import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";`);
      signerImports.push(`import { type AddressOptions } from "@api/model/AddressOptions";`);
      signerMethods.push(`  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;`);
    }
    if (includeSignTransaction) {
      signerImports.push(`import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";`);
      signerImports.push(`import { type TransactionOptions } from "@api/model/TransactionOptions";`);
      signerMethods.push(`  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;`);
    }
    if (includeSignMessage) {
      signerImports.push(`import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";`);
      signerMethods.push(`  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
  ) => SignMessageDAReturnType;`);
    }

    writeFile(`${baseDir}/src/api/Signer${pascalCase}.ts`, `${signerImports.join("\n")}

export interface Signer${pascalCase} {
${signerMethods.join("\n\n")}
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

    // Generate model files (conditional)
    if (includeGetAddress) {
      writeFile(`${baseDir}/src/api/model/AddressOptions.ts`, `export type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};
`);
    }

    if (includeSignTransaction) {
      writeFile(`${baseDir}/src/api/model/TransactionOptions.ts`, `export type TransactionOptions = {
  skipOpenApp?: boolean;
  // Add other options as needed
};
`);
    }

    if (includeSignTransaction || includeSignMessage) {
      writeFile(`${baseDir}/src/api/model/Signature.ts`, `export type Signature = {
  r: string;
  s: string;
  v?: number;
  // Adjust based on your blockchain's signature format
};
`);
    }

    if (includeGetAppConfig) {
      writeFile(`${baseDir}/src/api/model/AppConfig.ts`, `export type AppConfig = {
  // Define your app configuration fields here
  // Example:
  // version: string;
  // flags: number;
};
`);
    }

    // Generate app-binder device action types using helper functions
    for (const apiName of selectedApis) {
      const config = API_CONFIGS[apiName];
      const pascal = apiName.charAt(0).toUpperCase() + apiName.slice(1);
      const content = config.deviceActionType === "CallTaskInApp"
        ? generateCallTaskInAppDATypes(config, pascalCase, kebabCase)
        : generateSendCommandInAppDATypes(config, pascalCase, kebabCase);
      writeFile(`${baseDir}/src/api/app-binder/${pascal}DeviceActionTypes.ts`, content);
    }

    // Generate internal files
    writeFile(`${baseDir}/src/internal/externalTypes.ts`, `export const externalTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  ${useContextModule ? 'ContextModule: Symbol.for("ContextModule"),' : '// Add ContextModule if needed\n  // ContextModule: Symbol.for("ContextModule"),'}
} as const;
`);

    // Generate DefaultSigner - dynamic based on selected APIs
    const defaultSignerImports = [
      `import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";`,
      `import { type Container } from "inversify";`,
      `import { type Signer${pascalCase} } from "@api/Signer${pascalCase}";`,
      `import { makeContainer } from "@internal/di";`,
    ];
    const defaultSignerMethods = [];

    if (includeGetAppConfig) {
      defaultSignerImports.push(`import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";`);
      defaultSignerImports.push(`import { configTypes } from "@internal/use-cases/config/di/configTypes";`);
      defaultSignerImports.push(`import { type GetAppConfigUseCase } from "@internal/use-cases/config/GetAppConfigUseCase";`);
      defaultSignerMethods.push(`  getAppConfig(): GetAppConfigDAReturnType {
    return this._container
      .get<GetAppConfigUseCase>(configTypes.GetAppConfigUseCase)
      .execute();
  }`);
    }
    if (includeGetAddress) {
      defaultSignerImports.push(`import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";`);
      defaultSignerImports.push(`import { type AddressOptions } from "@api/model/AddressOptions";`);
      defaultSignerImports.push(`import { addressTypes } from "@internal/use-cases/address/di/addressTypes";`);
      defaultSignerImports.push(`import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";`);
      defaultSignerMethods.push(`  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }`);
    }
    if (includeSignTransaction) {
      defaultSignerImports.push(`import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";`);
      defaultSignerImports.push(`import { type TransactionOptions } from "@api/model/TransactionOptions";`);
      defaultSignerImports.push(`import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";`);
      defaultSignerImports.push(`import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";`);
      defaultSignerMethods.push(`  signTransaction(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }`);
    }
    if (includeSignMessage) {
      defaultSignerImports.push(`import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";`);
      defaultSignerImports.push(`import { messageTypes } from "@internal/use-cases/message/di/messageTypes";`);
      defaultSignerImports.push(`import { type SignMessageUseCase } from "@internal/use-cases/message/SignMessageUseCase";`);
      defaultSignerMethods.push(`  signMessage(
    derivationPath: string,
    message: string | Uint8Array,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(derivationPath, message);
  }`);
    }

    writeFile(`${baseDir}/src/internal/DefaultSigner${pascalCase}.ts`, `${defaultSignerImports.join("\n")}

type DefaultSigner${pascalCase}ConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSigner${pascalCase} implements Signer${pascalCase} {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSigner${pascalCase}ConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

${defaultSignerMethods.join("\n\n")}
}
`);

    // Generate DI container - dynamic based on selected APIs
    const diImports = [
      `import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";`,
      `import { Container } from "inversify";`,
      `import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";`,
      `import { externalTypes } from "@internal/externalTypes";`,
    ];
    const diModules = [`appBindingModuleFactory()`];

    if (includeGetAppConfig) {
      diImports.push(`import { configModuleFactory } from "@internal/use-cases/config/di/configModule";`);
      diModules.push(`configModuleFactory()`);
    }
    if (includeGetAddress) {
      diImports.push(`import { addressModuleFactory } from "@internal/use-cases/address/di/addressModule";`);
      diModules.push(`addressModuleFactory()`);
    }
    if (includeSignTransaction) {
      diImports.push(`import { transactionModuleFactory } from "@internal/use-cases/transaction/di/transactionModule";`);
      diModules.push(`transactionModuleFactory()`);
    }
    if (includeSignMessage) {
      diImports.push(`import { messageModuleFactory } from "@internal/use-cases/message/di/messageModule";`);
      diModules.push(`messageModuleFactory()`);
    }

    writeFile(`${baseDir}/src/internal/di.ts`, `${diImports.join("\n")}

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
    ${diModules.join(",\n    ")},
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

    // Generate AppBinder - dynamic based on selected APIs
    const appBinderDmkImports = ["type DeviceManagementKit", "type DeviceSessionId"];
    if (includeGetAppConfig || includeGetAddress || includeSignMessage) {
      appBinderDmkImports.push("SendCommandInAppDeviceAction");
    }
    if (includeSignTransaction) {
      appBinderDmkImports.push("CallTaskInAppDeviceAction");
    }
    appBinderDmkImports.push("UserInteractionRequired");

    const appBinderImports = [
      `import {
  ${appBinderDmkImports.join(",\n  ")},
} from "@ledgerhq/device-management-kit";`,
      `import { inject, injectable } from "inversify";`,
      `import { externalTypes } from "@internal/externalTypes";`,
    ];
    const appBinderCommandImports = [];
    const appBinderMethods = [];

    if (includeGetAppConfig) {
      appBinderImports.push(`import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";`);
      appBinderCommandImports.push(`import { GetAppConfigCommand } from "./command/GetAppConfigCommand";`);
      appBinderMethods.push(`  getAppConfig(args: {
    skipOpenApp: boolean;
  }): GetAppConfigDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigCommand(),
          appName: "${pascalCase}",
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }`);
    }

    if (includeGetAddress) {
      appBinderImports.push(`import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";`);
      appBinderCommandImports.push(`import { GetAddressCommand } from "./command/GetAddressCommand";`);
      appBinderMethods.push(`  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand(args),
          appName: "${pascalCase}",
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }`);
    }

    if (includeSignTransaction) {
      appBinderImports.push(`import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";`);
      appBinderCommandImports.push(`import { SignTransactionTask } from "./task/SignTransactionTask";`);
      appBinderMethods.push(`  signTransaction(args: {
    derivationPath: string;
    transaction: Uint8Array;
    skipOpenApp?: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SignTransactionTask(internalApi, args).run(),
          appName: "${pascalCase}",
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }`);
    }

    if (includeSignMessage) {
      appBinderImports.push(`import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";`);
      appBinderCommandImports.push(`import { SignMessageCommand } from "./command/SignMessageCommand";`);
      appBinderMethods.push(`  signMessage(args: {
    derivationPath: string;
    message: string | Uint8Array;
    skipOpenApp: boolean;
  }): SignMessageDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignMessageCommand(args),
          appName: "${pascalCase}",
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }`);
    }

    writeFile(`${baseDir}/src/internal/app-binder/${pascalCase}AppBinder.ts`, `${appBinderImports.join("\n")}

${appBinderCommandImports.join("\n")}

@injectable()
export class ${pascalCase}AppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

${appBinderMethods.join("\n\n")}
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

    // Generate command files using helper function
    for (const apiName of selectedApis) {
      const config = API_CONFIGS[apiName];
      writeFile(
        `${baseDir}/src/internal/app-binder/command/${config.commandClassName}.ts`,
        generateCommand(config, pascalCase, kebabCase)
      );
    }

    // Generate use-case files using helper functions
    for (const apiName of selectedApis) {
      const config = API_CONFIGS[apiName];
      // Generate DI types
      writeFile(
        `${baseDir}/src/internal/use-cases/${config.useCaseDir}/di/${config.useCaseTypesName}.ts`,
        generateUseCaseDITypes(config)
      );
      // Generate DI module
      writeFile(
        `${baseDir}/src/internal/use-cases/${config.useCaseDir}/di/${config.useCaseDir}Module.ts`,
        generateUseCaseDIModule(config)
      );
      // Generate use case class
      writeFile(
        `${baseDir}/src/internal/use-cases/${config.useCaseDir}/${config.useCaseClassName}.ts`,
        generateUseCase(config, pascalCase)
      );
    }

    // Generate device action placeholders and tasks using helper functions
    for (const apiName of selectedApis) {
      const config = API_CONFIGS[apiName];
      const pascal = apiName.charAt(0).toUpperCase() + apiName.slice(1);
      
      // Generate device action placeholder
      writeFile(
        `${baseDir}/src/internal/app-binder/device-action/${pascal}/${pascal}DeviceAction.ts`,
        generateDeviceActionPlaceholder(config)
      );
      
      // Generate task if needed (for CallTaskInApp APIs)
      if (config.taskClassName) {
        writeFile(
          `${baseDir}/src/internal/app-binder/task/${config.taskClassName}.ts`,
          generateTask(config, pascalCase, kebabCase)
        );
      }
    }

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
    console.log(chalk.yellow("   - APDU construction in commands (getApdu methods)"));
    console.log(chalk.yellow("   - Response parsing in commands (parseResponse methods)"));
    console.log(chalk.yellow("   - Error codes in " + kebabCase + "ApplicationErrors.ts"));
    if (includeSignTransaction) {
      console.log(chalk.yellow("   - SignTransactionTask implementation"));
    }
    console.log(chalk.gray("\nGenerated APIs: ") + chalk.cyan(selectedApis.join(", ")));

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
