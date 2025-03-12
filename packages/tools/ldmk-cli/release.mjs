#!/usr/bin/env zx

import "zx/globals";
import { checkbox, Separator, confirm } from "@inquirer/prompts";

async function setPrivateValue(pkg, privateValue) {
  const json = await fs.readJSON(pkg.path);
  json.private = privateValue;
  await fs.writeJSON(pkg.path, json, { spaces: 2 });
}

const GLOB = [
  // Grab all the package.json files except the ones in node_modules
  "**/package.json",
  "!**/node_modules/**",
  // Ignore the root package.json
  "!package.json",
  // Ignore compiled files
  "!**/lib/**",
  "!**/dist/**",
  // Ignore Apps
  "!**/apps/**",
  // Ignore Configs
  "!**/packages/config/**",
  // Ignore Tools
  "!**/packages/tools/**",
  // Ignore trusted apps and UI for now
  "!**/packages/trusted-apps/**",
  "!**/packages/ui/**",
];

async function getPackages() {
  const packages = await glob(GLOB);

  const groups = {};
  const pkgs = [];

  const packagesToPublish = packages.map((pkg) => {
    const split = pkg.split("/");
    const group = split[split.length - 3];
    const packageJson = fs.readJSONSync(pkg);

    groups[group] = groups[group] || [];
    const item = {
      path: pkg,
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private,
    };
    pkgs.push(item);
    groups[group].push(item);
  });

  return { groups, pkgs };
}

async function getOptions({ groups, pkgs }) {
  const formattedGroup = Object.entries(groups)
    .map(([group, packages]) => {
      const arr = [];
      arr.push(new Separator());
      arr.push({
        name: group,
        value: group,
        disabled: true,
      });

      for (const pkg of packages) {
        arr.push({
          name: pkg.name,
          value: pkg.name,
          checked: !pkg.private,
        });
      }

      return arr;
    })
    .flat();

  return formattedGroup;
}

export async function enterRelease() {
  try {
    const { groups, pkgs } = await getPackages();
    const choices = await getOptions({ groups, pkgs });

    const checkBoxes = await checkbox({
      message: "Select the packages to be released",
      choices,
      pageSize: 20,
    });

    for await (const pkg of pkgs) {
      if (checkBoxes.includes(pkg.name)) {
        await setPrivateValue(pkg, false);
      } else {
        await setPrivateValue(pkg, true);
      }
    }

    const confirmed = await confirm({
      message: "Do you want to commit the changes?",
      default: false,
    });

    if (!confirmed) {
      console.log(
        chalk.yellow("👋 Not committing the changes, don't forget to do it!")
      );
      console.log(chalk.green("👋 until next time!"));
      process.exit(0);
    }

    await $`git add .`;
    await $`git commit -m "🔧 (packages): Setup packages to be released"`;

    console.log(chalk.green("👌 Done! Don't forget to push the changes!"));
    process.exit(0);
  } catch (error) {
    console.error(
      chalk.red("👋 An error occurred while running the enter-release command")
    );
    console.error(chalk.red(error));
    process.exit(1);
  }
}

export async function exitRelease() {
  try {
    const { groups, pkgs } = await getPackages();

    const confirmed = await confirm({
      message: "Do you want to reset the private packages?",
    });

    if (!confirmed) {
      console.log(
        chalk.yellow(
          "👋 Not resetting the private packages, don't forget to do it before merging back to develop!"
        )
      );
      console.log(chalk.green("👋 until next time!"));
      process.exit(0);
    }

    for await (const pkg of pkgs) {
      await setPrivateValue(pkg, false);
    }

    const shouldCommit = await confirm({
      message: "Do you want to commit the changes?",
      default: false,
    });

    if (!shouldCommit) {
      console.log(
        chalk.yellow("👋 Not committing the changes, don't forget to do it!")
      );
      console.log(chalk.green("👋 until next time!"));
      process.exit(0);
    }

    await $`git add .`;
    await $`git commit -m "🔧 (packages): Reset private packages"`;

    console.log(chalk.green("👌 Done! Don't forget to push the changes!"));
    process.exit(0);
  } catch (error) {
    console.error(
      chalk.red("👋 An error occurred while running the exit-release command")
    );
    console.error(chalk.red(error));
    process.exit(1);
  }
}
