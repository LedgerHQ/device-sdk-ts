#!/usr/bin/env zx

require("zx/globals");
const { usePowerShell } = require("zx");
const { enterRelease, exitRelease } = require("./release.cjs");
const { help } = require("./help.cjs");
const { interactiveDMK } = require("./dmk.cjs");

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
    name: "enter-release",
    description: "toggle private on packages.json to be released",
    // NOTE: Example of a flag with a short name
    // flags: [{ name: "commit", description: "commit the changes", short: "c" }],
    flags: [],
  },
  {
    name: "exit-release",
    description: "toggle private on packages.json to be released",
    flags: [],
  },
  {
    name: "dmk",
    description: "enter interactive mode for the device management kit",
    flags: [],
  },
  {
    name: "help",
    description: "show available commands",
    flags: [],
  },
];

const command = argv._[0];

async function main() {
  switch (command) {
    case "help":
      help(availableCommands);
      break;
    case "enter-release":
      console.log(chalk.green("🔧 (packages): Entering release mode"));
      await enterRelease();
      break;
    case "exit-release":
      console.log(chalk.green("🔧 (packages): Exiting release mode"));
      await exitRelease();
      break;
    case "dmk":
      await interactiveDMK();
      break;
    default:
      console.log(chalk.red(`Invalid command: "${command}"`));
      console.log(chalk.red(""));
      help(availableCommands, true);
      process.exit(1);
  }
}

main();
