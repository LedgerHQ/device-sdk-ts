#!/usr/bin/env zx

require("zx/globals");

const {
  DeviceManagementKitBuilder,
  // ConsoleLogger,
} = require("@ledgerhq/device-management-kit");
const { help } = require("@ledgerhq/ldmk-tool/help.cjs");
const { input } = require("@inquirer/prompts");

const dmk = new DeviceManagementKitBuilder()
  // .addTransport(/* Node Transports (HID, BLE) */)
  // .addLogger(new ConsoleLogger())
  .build();

const header = (color) => {
  console.log(color("Usage:"));
  console.log(color("  dmk> <command> [flags]"));
  console.log(color(""));
  console.log(color("Available commands"));
};

const commands = [
  { name: "help", description: "display available DMK commands", flags: [] },
  {
    name: "version",
    description: "display the current version of the DMK",
    flags: [],
  },
  {
    name: "signer [family]",
    description: "loads a signer kit (eg: signer eth)",
    flags: [],
  },
  {
    name: "exit",
    description: "exit the interactive DMK mode",
    flags: [],
  },
];

let PREFIX = "dmk>";

const handlers = {
  exit: (_result) => {
    console.log(
      `${chalk.magenta.bold(PREFIX)}  ${chalk.white("exiting interactive mode")}`,
    );
    process.exit(0);
  },
  version: async (_result) => {
    const version = await dmk.getVersion();
    console.log(
      `${chalk.magenta.bold(PREFIX)}  ${chalk.white(`DMK v${version}`)}`,
    );
    return listenForDmkCommand();
  },
  help: (_result) => {
    console.log("");
    help(commands, false, header);
    return listenForDmkCommand();
  },
  signer: (result) => {
    const args = minimist(result.split(" "));
    const command = args._[0];
    const coin = args._[1];
    console.log(
      `${chalk.magenta.bold(PREFIX)}  ${chalk.white(`loading signer kit for ${coin} family`)}`,
    );
    // TODO: Check that the coin is supported and return antother function
    // that handles signer kit specific commands
    // We might need to have specific command handlers for each coin depending on their capabilities
    PREFIX = `dmk|${coin}>`;
    return listenForSignerCommand();
  },
  default: (_result) => {
    console.log(
      `${chalk.magenta.bold(PREFIX)}  ${chalk.red(`invalid command: "${command}"`)}`,
    );
    console.log("");
    help(commands, true, header);
    return listenForDmkCommand();
  },
};

async function listenForDmkCommand() {
  const result = await input({
    message: "",
    theme: {
      prefix: chalk.magenta.bold(PREFIX),
    },
  });

  const args = minimist(result.split(" "));
  const command = args._[0];

  const handler = handlers[command] || handlers.default;
  return handler(result);
}

async function listenForSignerCommand() {
  console.log(
    `${chalk.magenta.bold(PREFIX)}  ${chalk.white("waiting for signer command...")}`,
  );
  const result = await input({
    message: "",
    theme: {
      prefix: chalk.magenta.bold(PREFIX),
    },
  });

  if (result === "exit") {
    PREFIX = "dmk>";
    return listenForDmkCommand();
  }

  console.log(
    `${chalk.magenta.bold(PREFIX)}  ${chalk.red(`signer commands not yet implemented: "${result}"`)}`,
  );
  console.log(
    `${chalk.magenta.bold(PREFIX)}  ${chalk.red(`only the "exit" command is available for now`)}`,
  );
  console.log("");
  return listenForSignerCommand();
}

async function interactiveDMK() {
  console.log(chalk.blue("Welcome to the DMK interactive mode"));
  listenForDmkCommand();
}

module.exports = {
  interactiveDMK,
};
