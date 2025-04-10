#!/usr/bin/env zx

require("zx/globals");

const defaultHeader = (color) => {
  console.log(color("Usage:"));
  console.log(color("  ldmk-tool <command> [flags]"));
  console.log(color(""));
  console.log(color("Available commands"));
};

const help = (commands, danger = false, header = defaultHeader) => {
  const getColor = (command) => {
    if (!!command?.internal) {
      return chalk.gray;
    }

    if (danger) {
      return chalk.red;
    }
    return chalk.blue;
  };
  header(getColor());
  for (const command of commands) {
    const color = getColor(command);
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
  console.log(getColor()(""));
};

module.exports = {
  help,
};
