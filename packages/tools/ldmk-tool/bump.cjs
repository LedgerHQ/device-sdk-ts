#!/usr/bin/env zx

require("zx/globals");
const { confirm } = require("@inquirer/prompts");

/**
 * Bump package versions using changesets
 * Runs changeset version and optionally commits the result
 */
async function bump() {
  try {
    console.log(chalk.blue("Running changeset version..."));
    console.log("");

    // Run changeset version
    await $`pnpm changeset version`;

    // =======================
    // Show git status
    // =======================

    const res = await $`git status`;
    console.log(chalk.blue(res.stdout));

    // =======================
    // Ask to commit the changes
    // =======================

    const confirmed = await confirm({
      message: "Do you want to commit the changes?",
      default: false,
    });

    if (!confirmed) {
      console.log(
        chalk.yellow("👋 Not committing the changes, don't forget to do it!"),
      );
      console.log(chalk.green("👋 until next time!"));
      process.exit(0);
    }

    await $`git add .`;
    await $`git commit -m "🔖 (packages): Bump versions"`;

    console.log(chalk.green("👌 Done! Don't forget to push the changes!"));
    process.exit(0);
  } catch (error) {
    console.error(
      chalk.red("👋 An error occurred while running the bump command"),
    );
    console.error(chalk.red(error));
    process.exit(1);
  }
}

module.exports = {
  bump,
};
