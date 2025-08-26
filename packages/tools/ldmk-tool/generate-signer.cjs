#!/usr/bin/env zx

require("zx/globals");
const { input, confirm } = require("@inquirer/prompts");
const { execSync } = require("child_process");
const path = require("path");

async function generateSigner() {
  console.log(chalk.blue("🚀 Welcome to the Ledger Device SDK Signer Generator"));
  console.log(chalk.gray("This will create a new signer package skeleton for your cryptocurrency.\n"));

  try {
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

    // Create the signer package by copying and adapting the Canton structure
    const fs = require("fs");
    const path = require("path");
    
    const kebabCase = cryptoName.toLowerCase();
    const baseDir = `packages/signer/signer-kit-${kebabCase}`;
    const cantonDir = "packages/signer/signer-kit-canton";
    
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
      `${baseDir}/src/internal/use-cases`,
      `${baseDir}/src/internal/use-cases/address`,
      `${baseDir}/src/internal/use-cases/transaction`,
      `${baseDir}/src/internal/use-cases/di`,
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    function copyAndAdaptFile(src, dest, replacements = {}) {
      if (fs.existsSync(src)) {
        let content = fs.readFileSync(src, 'utf8');
        
        // Apply replacements
        Object.entries(replacements).forEach(([key, value]) => {
          content = content.replace(new RegExp(key, 'g'), value);
        });
        
        fs.writeFileSync(dest, content);
        console.log(chalk.green(`✅ Created ${dest}`));
      } else {
        console.log(chalk.yellow(`⚠️  Source file not found: ${src}`));
      }
    }

    console.log(chalk.gray("\n📦 Copying and adapting files..."));
    
    // Copy configuration files
    copyAndAdaptFile(`${cantonDir}/package.json`, `${baseDir}/package.json`, {
      'canton': kebabCase,
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/tsconfig.json`, `${baseDir}/tsconfig.json`);
    copyAndAdaptFile(`${cantonDir}/tsconfig.prod.json`, `${baseDir}/tsconfig.prod.json`);
    copyAndAdaptFile(`${cantonDir}/eslint.config.mjs`, `${baseDir}/eslint.config.mjs`);
    copyAndAdaptFile(`${cantonDir}/vitest.config.mjs`, `${baseDir}/vitest.config.mjs`);
    copyAndAdaptFile(`${cantonDir}/vitest.setup.mjs`, `${baseDir}/vitest.setup.mjs`);
    copyAndAdaptFile(`${cantonDir}/.prettierrc.js`, `${baseDir}/.prettierrc.js`);
    copyAndAdaptFile(`${cantonDir}/.prettierignore`, `${baseDir}/.prettierignore`);

    // Copy source files
    copyAndAdaptFile(`${cantonDir}/src/index.ts`, `${baseDir}/src/index.ts`);

    // Copy API files
    copyAndAdaptFile(`${cantonDir}/src/api/index.ts`, `${baseDir}/src/api/index.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/api/SignerCanton.ts`, `${baseDir}/src/api/Signer${cryptoName}.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/api/SignerCantonBuilder.ts`, `${baseDir}/src/api/Signer${cryptoName}Builder.ts`, {
      'Canton': cryptoName,
      'canton': kebabCase
    });

    // Copy model files
    copyAndAdaptFile(`${cantonDir}/src/api/model/AddressOption.ts`, `${baseDir}/src/api/model/AddressOption.ts`);
    copyAndAdaptFile(`${cantonDir}/src/api/model/TransactionOptions.ts`, `${baseDir}/src/api/model/TransactionOptions.ts`, {
      'Canton': cryptoName
    });
    copyAndAdaptFile(`${cantonDir}/src/api/model/Transaction.ts`, `${baseDir}/src/api/model/Transaction.ts`);
    copyAndAdaptFile(`${cantonDir}/src/api/model/Signature.ts`, `${baseDir}/src/api/model/Signature.ts`);
    copyAndAdaptFile(`${cantonDir}/src/api/model/PublicKey.ts`, `${baseDir}/src/api/model/PublicKey.ts`);

    // Copy app-binder files
    copyAndAdaptFile(`${cantonDir}/src/api/app-binder/GetAddressDeviceActionTypes.ts`, `${baseDir}/src/api/app-binder/GetAddressDeviceActionTypes.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/api/app-binder/SignTransactionDeviceActionTypes.ts`, `${baseDir}/src/api/app-binder/SignTransactionDeviceActionTypes.ts`, {
      'Canton': cryptoName
    });

    // Copy internal files
    copyAndAdaptFile(`${cantonDir}/src/internal/externalTypes.ts`, `${baseDir}/src/internal/externalTypes.ts`);
    copyAndAdaptFile(`${cantonDir}/src/internal/DefaultSignerCanton.ts`, `${baseDir}/src/internal/DefaultSigner${cryptoName}.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/internal/di.ts`, `${baseDir}/src/internal/di.ts`);

    // Copy app-binder internal files
    copyAndAdaptFile(`${cantonDir}/src/internal/app-binder/di/appBinderTypes.ts`, `${baseDir}/src/internal/app-binder/di/appBinderTypes.ts`);
    copyAndAdaptFile(`${cantonDir}/src/internal/app-binder/di/appBinderModule.ts`, `${baseDir}/src/internal/app-binder/di/appBinderModule.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/internal/app-binder/CantonAppBinder.ts`, `${baseDir}/src/internal/app-binder/${cryptoName}AppBinder.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/internal/app-binder/command/utils/CantonApplicationErrors.ts`, `${baseDir}/src/internal/app-binder/command/utils/${cryptoName}ApplicationErrors.ts`, {
      'CANTON': cryptoName.toUpperCase()
    });

    copyAndAdaptFile(`${cantonDir}/src/internal/app-binder/command/GetAddressCommand.ts`, `${baseDir}/src/internal/app-binder/command/GetAddressCommand.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/internal/app-binder/command/SignTransactionCommand.ts`, `${baseDir}/src/internal/app-binder/command/SignTransactionCommand.ts`, {
      'Canton': cryptoName
    });

    // Copy use-cases files
    copyAndAdaptFile(`${cantonDir}/src/internal/use-cases/di/useCasesTypes.ts`, `${baseDir}/src/internal/use-cases/di/useCasesTypes.ts`);
    copyAndAdaptFile(`${cantonDir}/src/internal/use-cases/di/useCasesModule.ts`, `${baseDir}/src/internal/use-cases/di/useCasesModule.ts`);

    copyAndAdaptFile(`${cantonDir}/src/internal/use-cases/address/GetAddressUseCase.ts`, `${baseDir}/src/internal/use-cases/address/GetAddressUseCase.ts`, {
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/src/internal/use-cases/transaction/SignTransactionUseCase.ts`, `${baseDir}/src/internal/use-cases/transaction/SignTransactionUseCase.ts`, {
      'Canton': cryptoName
    });

    // Copy device action files
    copyAndAdaptFile(`${cantonDir}/src/internal/app-binder/device-action/GetAddress/GetAddressDeviceAction.ts`, `${baseDir}/src/internal/app-binder/device-action/GetAddress/GetAddressDeviceAction.ts`, {
      'Canton': cryptoName
    });

    // Copy documentation files
    copyAndAdaptFile(`${cantonDir}/README.md`, `${baseDir}/README.md`, {
      'canton': kebabCase,
      'Canton': cryptoName
    });

    copyAndAdaptFile(`${cantonDir}/CHANGELOG.md`, `${baseDir}/CHANGELOG.md`, {
      'Canton': cryptoName
    });

    console.log(chalk.green("\n🎉 Signer package generated successfully!"));
    console.log(chalk.gray("\nNext steps:"));
    console.log(chalk.gray("1. Navigate to the generated package:"));
    console.log(chalk.cyan(`   cd packages/signer/signer-kit-${cryptoName.toLowerCase()}`));
    console.log(chalk.gray("2. Install dependencies:"));
    console.log(chalk.cyan("   pnpm install"));
    console.log(chalk.gray("3. Build the package:"));
    console.log(chalk.cyan("   pnpm build"));
    console.log(chalk.gray("4. Start developing your signer implementation!"));

  } catch (error) {
    if (error.name === "ExitPromptError") {
      console.log(chalk.yellow("\n❌ Generation cancelled by user"));
      process.exit(0);
    } else {
      console.error(chalk.red("\n❌ Error generating signer package:"), error.message);
      process.exit(1);
    }
  }
}

module.exports = {
  generateSigner,
};
