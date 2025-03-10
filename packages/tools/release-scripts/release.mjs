#!/usr/bin/env zx

import "zx/globals";
import { usePowerShell } from "zx";
import { checkbox, Separator, confirm } from "@inquirer/prompts";

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

async function setPrivateValue(pkg, privateValue) {
  const json = await fs.readJSON(pkg.path);
  json.private = privateValue;
  await fs.writeJSON(pkg.path, json, { spaces: 2 });
}

// Get all the packages that can be published on npm
const packages = await glob([
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
]);

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

const checkBoxes = await checkbox({
  message: "Select the packages to be released",
  choices: formattedGroup,
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
