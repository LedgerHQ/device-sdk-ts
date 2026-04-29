#!/usr/bin/env zx

require("zx/globals");
const { usePowerShell } = require("zx");
const { help } = require("./help.cjs");
const { build } = require("./build.cjs");
const { watch } = require("./watch.cjs");
const { bumpSnapshot } = require("./bump-snapshot.cjs");
const { pack } = require("./pack.cjs");
const { canonicalize } = require("./canonicalize.cjs");
const { generateSigner } = require("./generate-signer.cjs");

if (process.platform === "win32") {
  usePowerShell();
}

process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    console.log(chalk.red("Script aborted by the user: SIGINT"));
    process.exit(0);
  } else {
    // Rethrow unknown errors
    throw error;
  }
});

const availableCommands = [
  {
    name: "bump-snapshot",
    description:
      "create a changeset for all public packages and bump versions for snapshot release",
    flags: [
      {
        name: "tag",
        description:
          "snapshot tag (e.g., develop, canary) - defaults to develop",
      },
      {
        name: "type",
        description: "bump type (patch, minor, major) - defaults to patch",
      },
    ],
  },
  {
    name: "generate-signer",
    description: "generate a new signer package skeleton for a cryptocurrency",
    flags: [],
  },
  {
    name: "help",
    description: "show available commands",
    flags: [],
  },
  {
    name: "build (internal use only)",
    internal: true,
    description: "build the selected package",
    flags: [
      {
        name: "entryPoints",
        description:
          "the entry points to build, can be a single file or a comma separated list",
      },
      { name: "tsconfig", description: "the tsconfig file to use" },
      { name: "platform", description: "the platform to build for" },
    ],
  },
  {
    name: "watch (internal use only)",
    internal: true,
    description: "watch the selected package and recompile on change",
    flags: [
      {
        name: "entryPoints",
        description:
          "the entry points to watch, can be a single file or a comma separated list",
      },
      { name: "tsconfig", description: "the tsconfig file to use" },
      { name: "platform", description: "the platform to watch for" },
    ],
  },
  {
    name: "pack",
    description: "pack all public packages to dist directory",
    flags: [
      {
        name: "packagesDir",
        description: "the directory containing packages (default: packages)",
      },
      {
        name: "distDir",
        description: "the output directory for packed files (default: dist)",
      },
    ],
  },
  {
    name: "canonicalize",
    description: "canonicalize (sort keys) all package.json files",
    flags: [
      {
        name: "packagesDir",
        description: "the directory containing packages (default: packages)",
      },
      {
        name: "check",
        description: "check if files need canonicalization without modifying",
      },
    ],
  },
];

const command = argv._[0];
const {
  entryPoints,
  tsconfig,
  platform,
  packagesDir,
  distDir,
  check,
  type,
  tag,
} = argv;

async function main() {
  switch (command) {
    case "help":
      help(availableCommands);
      break;
    case "generate-signer":
      console.log(chalk.green("🚀 Generating new signer package"));
      await generateSigner();
      break;
    case "bump-snapshot":
      console.log(
        chalk.green(
          `🔖 (packages): Creating snapshot versions for all public packages with tag: ${tag}`,
        ),
      );
      await bumpSnapshot(tag, type || "patch");
      break;
    case "build":
      if (!entryPoints) {
        console.error(chalk.red("Entry points are required"));
        process.exit(1);
      }

      if (!tsconfig) {
        console.error(chalk.red("TSConfig file is required"));
        process.exit(1);
      }

      console.log(chalk.green("🛠️ (packages): Building"));
      build(entryPoints, tsconfig, platform)
        .then(() => {
          console.log(chalk.green("✅ Build succeeded"));
          process.exitCode = 0;
        })
        .catch((e) => {
          console.error(chalk.red("❌ Build failed"));
          console.error(e);
          process.exitCode = e.exitCode;
        });
      break;
    case "watch":
      if (!entryPoints) {
        console.error(chalk.red("Entry points are required"));
        process.exit(1);
      }

      if (!tsconfig) {
        console.error(chalk.red("TSConfig file is required"));
        process.exit(1);
      }

      console.log(chalk.green("👀 (packages): Watching"));
      await watch(entryPoints, tsconfig, platform).catch((e) => {
        console.error(e);
        process.exitCode = e.exitCode;
      });
      break;
    case "pack":
      console.log(chalk.green("📦 (packages): Packing"));
      await pack(packagesDir, distDir)
        .then(() => {
          console.log(chalk.green("✅ Pack succeeded"));
          process.exitCode = 0;
        })
        .catch((e) => {
          console.error(chalk.red("❌ Pack failed"));
          console.error(e);
          process.exitCode = e.exitCode || 1;
        });
      break;
    case "canonicalize":
      console.log(
        chalk.green(
          `🔧 (packages): ${check ? "Checking" : "Canonicalizing"} package.json files`,
        ),
      );
      await canonicalize(packagesDir, check)
        .then(() => {
          console.log(chalk.green("✅ Canonicalize succeeded"));
          process.exitCode = 0;
        })
        .catch((e) => {
          console.error(chalk.red("❌ Canonicalize failed"));
          console.error(e);
          process.exitCode = e.exitCode || 1;
        });
      break;
    default:
      console.log(chalk.red(`Invalid command: "${command}"`));
      console.log(chalk.red(""));
      help(availableCommands, true);
      process.exit(1);
  }
}

main();
