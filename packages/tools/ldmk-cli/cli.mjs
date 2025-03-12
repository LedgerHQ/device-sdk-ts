#!/usr/bin/env zx

import "zx/globals";
import { usePowerShell } from "zx";
import { enterRelease, exitRelease } from "./release.mjs";
import { help } from "./help.mjs";

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
    name: "help",
    description: "show available commands",
    flags: [],
  },
];

const command = argv._[0];

if (!availableCommands.some((c) => c.name === command)) {
  console.log(chalk.red(`Invalid command: "${command}"`));
  console.log(chalk.red(""));
  help(availableCommands, true);
  process.exit(1);
}

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
}
