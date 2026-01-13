#!/usr/bin/env zx

require("zx/globals");
const {
  checkbox,
  Separator,
  confirm,
  input,
  select,
} = require("@inquirer/prompts");
const semver = require("semver");

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
  // Ignore UI for now
  "!**/packages/ui/**",
];

async function setPrivateValue(pkg, privateValue) {
  const json = await fs.readJSON(pkg.path);
  json.private = privateValue;
  await fs.writeJSON(pkg.path, json, { spaces: 2 });
}

async function getPackages() {
  const packages = await glob(GLOB);

  const groups = {};
  const pkgs = [];

  packages.forEach((pkg) => {
    const split = pkg.split("/");
    const group = split[split.length - 3];
    const packageJson = fs.readJsonSync(pkg);

    groups[group] = groups[group] || [];
    const item = {
      path: pkg,
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private,
      dependencies: packageJson.dependencies || {},
      peerDependencies: packageJson.peerDependencies || {},
    };
    pkgs.push(item);
    groups[group].push(item);
  });

  return { groups, pkgs };
}

async function getOptions({ groups }) {
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

async function resetPrivatePackagesDependencies(pkgs) {
  for (const pkg of pkgs) {
    let shouldUpdate = false;
    const json = await fs.readJSON(pkg.path);
    const { dependencies, peerDependencies } = json;

    if (dependencies) {
      for (const dependency of Object.keys(dependencies)) {
        if (!dependency) continue;
        if (pkgs.some((p) => p.name === dependency)) {
          json.dependencies[dependency] = "workspace:^";
          shouldUpdate = true;
        }
      }
    }

    if (peerDependencies) {
      for (const dependency of Object.keys(peerDependencies)) {
        if (!dependency) continue;
        if (pkgs.some((p) => p.name === dependency)) {
          json.peerDependencies[dependency] = "workspace:^";
          shouldUpdate = true;
        }
      }
    }

    if (shouldUpdate) {
      await fs.writeJSON(pkg.path, json, { spaces: 2 });
    }
  }
}

async function enterRelease() {
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

    // =======================
    // Check for workspace dependencies in the updated packages
    // =======================

    const { pkgs: updatedPkgs } = await getPackages();

    const packagesToBePublished = updatedPkgs.filter((pkg) => !pkg.private);
    const linkedDependencies = [];

    for (const pkg of packagesToBePublished) {
      const packageJson = await fs.readJSON(pkg.path);

      const dependencies = packageJson.dependencies;
      const peerDependencies = packageJson.peerDependencies;

      if (dependencies) {
        for (const [dependency, value] of Object.entries(dependencies)) {
          const included = packagesToBePublished.some(
            (v) => v.name === dependency,
          );

          if (value.includes("workspace") && !included) {
            linkedDependencies.push({
              package: pkg.name,
              path: pkg.path,
              type: "dependency",
              dependency,
              version: value,
              currentVersion: pkgs.find((p) => p.name === dependency)?.version,
            });
          }
        }
      }

      if (peerDependencies) {
        for (const [dependency, value] of Object.entries(peerDependencies)) {
          const included = packagesToBePublished.some(
            (v) => v.name === dependency,
          );

          if (value.includes("workspace") && !included) {
            linkedDependencies.push({
              package: pkg.name,
              path: pkg.path,
              type: "peerDependency",
              dependency,
              version: value,
              currentVersion: pkgs.find((p) => p.name === dependency)?.version,
            });
          }
        }
      }
    }

    if (linkedDependencies.length > 0) {
      console.log("");
      console.log(chalk.blue("⚠️ Workspace dependencies found !!"));
      console.log("");

      for (const pkg of packagesToBePublished) {
        const deps = linkedDependencies.filter((d) => d.package === pkg.name);

        if (deps.length > 0) {
          console.log(
            `${chalk.magenta(`${pkg.name} has workspace dependencies`)}`,
          );
          console.log("");

          const json = await fs.readJSON(pkg.path);

          for (const dependency of deps) {
            const shouldUpdate = await confirm({
              message: `Do you want to update ${dependency.dependency} in ${dependency.type === "dependency" ? "dependencies" : "peerDependencies"}?`,
            });

            if (shouldUpdate) {
              const version = await input({
                message: `Enter the version for ${dependency.dependency} (current: ${dependency.currentVersion})`,
                default: dependency.currentVersion,
              });

              const range = await select({
                message: `Enter the range for ${dependency.dependency}`,
                choices: [
                  {
                    name: `current (${version})`,
                    value: "",
                    description: "Exact current version (eg: 1.2.3)",
                  },
                  {
                    name: `^${version}`,
                    value: "^",
                    description: "(eg: ^1.2.3 is >=1.2.3 <2.0.0)",
                  },
                  {
                    name: `~${version}`,
                    value: "~",
                    description: "(eg: ~1.2.3 is >=1.2.3 <1.3.0)",
                  },
                ],
              });

              if (semver.valid(version)) {
                json[
                  dependency.type === "dependency"
                    ? "dependencies"
                    : "peerDependencies"
                ][dependency.dependency] =
                  range === "" ? version : `${range}${version}`;

                await fs.writeJSON(pkg.path, json, { spaces: 2 });
              } else {
                console.log(
                  chalk.red(
                    `Invalid version for ${dependency.dependency}, please follow the semver convention`,
                  ),
                );
                process.exit(1);
              }
              console.log("");
            }
          }
        }
      }
    }

    // =======================
    // Check for packages that depend on released packages with MAJOR bumps
    // =======================

    // Read all changeset files to find which packages have major bumps
    const changesetDir = path.join(process.cwd(), ".changeset");
    let changesetMdFiles = [];
    try {
      const changesetFiles = await fs.readdir(changesetDir);
      changesetMdFiles = changesetFiles.filter(
        (f) => f.endsWith(".md") && f !== "README.md",
      );
    } catch (err) {
      // If the .changeset directory is missing or inaccessible, treat as no changesets
      if (
        !err ||
        !err.code ||
        !["ENOENT", "ENOTDIR", "EACCES"].includes(err.code)
      ) {
        throw err;
      }
    }

    const packagesWithMajorBump = new Set();

    // Read all changeset files in parallel for better performance
    const changesetContents = await Promise.all(
      changesetMdFiles.map(async (file) => ({
        file,
        content: await fs.readFile(path.join(changesetDir, file), "utf-8"),
      })),
    );

    for (const { content } of changesetContents) {
      // Parse the frontmatter to find packages with major bumps
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const lines = frontmatter.split("\n");
        for (const line of lines) {
          // Match lines like: "@ledgerhq/package-name": major
          const match = line.match(/"([^"]+)":\s*major/);
          if (match) {
            packagesWithMajorBump.add(match[1]);
          }
        }
      }
    }

    // Only proceed if there are selected packages with major bumps
    const selectedPackageNames = checkBoxes;
    const selectedWithMajorBump = selectedPackageNames.filter((pkg) =>
      packagesWithMajorBump.has(pkg),
    );

    if (selectedWithMajorBump.length > 0) {
      const { pkgs: allPackages } = await getPackages();
      const nonSelectedPackages = allPackages.filter(
        (pkg) => !selectedPackageNames.includes(pkg.name),
      );

      // Find packages that depend on any of the selected packages WITH MAJOR bumps
      const dependentPackages = [];
      for (const pkg of nonSelectedPackages) {
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.peerDependencies,
        };

        // Only check dependencies on packages that have major bumps
        const dependsOnMajorBump = selectedWithMajorBump.filter(
          (selectedPkg) => selectedPkg in allDeps,
        );

        if (dependsOnMajorBump.length > 0) {
          dependentPackages.push({
            ...pkg,
            dependsOn: dependsOnMajorBump,
          });
        }
      }

      if (dependentPackages.length > 0) {
        console.log("");
        console.log(
          chalk.yellow(
            "⚠️  WARNING: The following packages have MAJOR version bumps:",
          ),
        );
        for (const pkg of selectedWithMajorBump) {
          console.log(chalk.red(`  🔺 ${pkg}`));
        }
        console.log("");
        console.log(
          chalk.yellow(
            "The following packages depend on them but are not selected for release:",
          ),
        );
        console.log("");

        for (const pkg of dependentPackages) {
          console.log(
            chalk.magenta(`  📦 ${pkg.name}`) +
              chalk.gray(` depends on: ${pkg.dependsOn.join(", ")}`),
          );
        }

        console.log("");
        console.log(
          chalk.yellow(
            "Since these are MAJOR bumps, the ^ version range won't cover them.",
          ),
        );
        console.log(
          chalk.yellow(
            "Consumers may experience issues with duplicate dependencies.",
          ),
        );
        console.log("");

        const shouldIncludeDependents = await confirm({
          message:
            "Do you want to include these dependent packages in the release? (will create patch changesets and set private: false)",
          default: true,
        });

        if (shouldIncludeDependents) {
          // Set private: false for dependent packages (only if not already public)
          for (const pkg of dependentPackages) {
            if (pkg.private !== false) {
              await setPrivateValue(pkg, false);
              console.log(
                chalk.green(`  ✅ Set ${pkg.name} as public (private: false)`),
              );
            }
          }

          // Create a changeset file for dependent packages
          const changesetId = `dependent-packages-${Date.now()}`;
          const changesetPath = path.join(changesetDir, `${changesetId}.md`);

          const dependentPackageNames = dependentPackages.map((pkg) => pkg.name);
          const changesetContent = `---
${dependentPackageNames.map((name) => `"${name}": patch`).join("\n")}
---

Bump packages due to major dependency updates
`;

          await fs.writeFile(changesetPath, changesetContent, "utf-8");
          console.log("");
          console.log(
            chalk.green(
              `  ✅ Created changeset for dependent packages: .changeset/${changesetId}.md`,
            ),
          );
          console.log("");
        } else {
          console.log(
            chalk.yellow(
              "⚠️  Skipping dependent packages. Be aware of potential dependency duplication issues.",
            ),
          );
          console.log("");
        }
      }
    }

    // =======================
    // Update lock file
    // =======================

    await spinner("Updating lock file", () => $`pnpm i`);

    // =======================
    // Commit the changes
    // =======================

    const res = await $`git status`;
    console.log(chalk.blue(res.stdout));

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
    await $`git commit -m "🔧 (packages): Setup packages to be released"`;

    console.log(chalk.green("👌 Done! Don't forget to push the changes!"));
    process.exit(0);
  } catch (error) {
    console.error(
      chalk.red("👋 An error occurred while running the enter-release command"),
    );
    console.error(chalk.red(error));
    process.exit(1);
  }
}

async function exitRelease() {
  try {
    const { pkgs } = await getPackages();

    const confirmed = await confirm({
      message: "Do you want to reset the private packages?",
    });

    if (!confirmed) {
      console.log(
        chalk.yellow(
          "👋 Not resetting the private packages, don't forget to do it before merging back to develop!",
        ),
      );
      console.log(chalk.green("👋 until next time!"));
      process.exit(0);
    }

    for (const pkg of pkgs) {
      await setPrivateValue(pkg, false);
    }

    const { pkgs: updatedPkgs } = await getPackages();
    await resetPrivatePackagesDependencies(updatedPkgs);

    // =======================
    // Update lock file
    // =======================

    await spinner("Updating lock file", () => $`pnpm i`);

    // =======================
    // Commit the changes
    // =======================

    const res = await $`git status`;
    console.log(chalk.blue(res.stdout));

    const shouldCommit = await confirm({
      message: "Do you want to commit the changes?",
      default: false,
    });

    if (!shouldCommit) {
      console.log(
        chalk.yellow("👋 Not committing the changes, don't forget to do it!"),
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
      chalk.red("👋 An error occurred while running the exit-release command"),
    );
    console.error(chalk.red(error));
    process.exit(1);
  }
}

module.exports = {
  enterRelease,
  exitRelease,
};
