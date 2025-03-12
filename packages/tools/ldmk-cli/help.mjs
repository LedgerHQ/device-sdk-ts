#!/usr/bin/env zx

import "zx/globals";

export const help = (commands, danger = false) => {
  const color = danger ? chalk.red : chalk.blue;
  console.log(color("Usage:"));
  console.log(color("  lmdk-cli <command> [flags]"));
  console.log(color(""));
  console.log(color("Available commands"));
  for (const command of commands) {
    console.log(color(`▶︎  ${command.name}: ${command.description}`));
    if (command.flags.length > 0) {
      console.log(color("   > flags:"));
      for (const flag of command.flags) {
        console.log(
          color(
            `     --${flag.name}${flag.short ? `, -${flag.short}` : ""}: ${flag.description}`
          )
        );
      }
    }
  }
  console.log(color(""));
};
