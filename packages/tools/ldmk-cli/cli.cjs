#!/usr/bin/env zx

require("zx/globals");
const { usePowerShell } = require("zx");
const { help } = require("@ledgerhq/ldmk-tool/help.cjs");
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
