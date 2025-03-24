#!/usr/bin/env zx

require("zx/globals");

const defaultHeader = (color) => {
  console.log(color("Usage:"));
  console.log(color("  lmdk-cli <command> [flags]"));
  console.log(color(""));
  console.log(color("Available commands"));
};

const help = (commands, danger = false, header = defaultHeader) => {
  const color = danger ? chalk.red : chalk.blue;
  header(color);
  for (const command of commands) {
    console.log(color(`▶︎  ${command.name}: ${command.description}`));
    if (command.flags.length > 0) {
      console.log(color("   > flags:"));
      for (const flag of command.flags) {
        console.log(
          color(
            `     --${flag.name}${flag.short ? `, -${flag.short}` : ""}: ${flag.description}`,
          ),
        );
      }
    }
  }
  console.log(color(""));
};

module.exports = {
  help,
};
