#!/usr/bin/env zx

require("zx/globals");

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

/**
 * Get all public packages in the workspace
 */
async function getPublicPackages() {
  const packages = await glob(GLOB);
  const publicPackages = [];

  for (const pkgPath of packages) {
    const packageJson = await fs.readJSON(pkgPath);

    // Only include non-private packages
    if (!packageJson.private && packageJson.name) {
      publicPackages.push({
        name: packageJson.name,
        version: packageJson.version,
        path: pkgPath,
      });
    }
  }

  return publicPackages;
}

/**
 * Create a changeset file that includes all public packages and run changeset version
 * @param {string} tag - The snapshot tag (e.g., "develop", "canary")
 * @param {string} bumpType - The version bump type (patch, minor, major)
 */
async function bumpSnapshot(tag = "develop", bumpType = "patch") {
  try {
    const PROJECT_ROOT = process.cwd();
    const CHANGESET_DIR = path.join(PROJECT_ROOT, ".changeset");

    console.log(chalk.blue("📦 Finding all public packages..."));
    console.log("");

    // Get all public packages
    const publicPackages = await getPublicPackages();

    if (publicPackages.length === 0) {
      console.log(chalk.yellow("No public packages found"));
      process.exit(0);
    }

    console.log(
      chalk.green(`Found ${publicPackages.length} public package(s):`),
    );
    publicPackages.forEach((pkg) => {
      console.log(chalk.gray(`  - ${pkg.name}`));
    });
    console.log("");

    // Validate bump type
    if (!["patch", "minor", "major"].includes(bumpType)) {
      throw new Error(
        `Invalid bump type: ${bumpType}. Must be one of: patch, minor, major`,
      );
    }

    console.log(chalk.blue("Creating changeset using changeset CLI..."));
    console.log("");

    // Create an empty changeset using the changeset CLI
    // This will create a new changeset file with a random ID
    await $`pnpm changeset add --empty`;

    // Find the most recently created changeset file
    const changesetFiles = await fs.readdir(CHANGESET_DIR);
    const changesetMdFiles = changesetFiles.filter(
      (f) => f.endsWith(".md") && f !== "README.md",
    );

    // Sort by modification time to get the most recent
    const changesetPaths = await Promise.all(
      changesetMdFiles.map(async (file) => {
        const filePath = path.join(CHANGESET_DIR, file);
        const stats = await fs.stat(filePath);
        return { file, path: filePath, mtime: stats.mtime };
      }),
    );

    changesetPaths.sort((a, b) => b.mtime - a.mtime);

    if (changesetPaths.length === 0) {
      throw new Error("Failed to create changeset file");
    }

    const changesetPath = changesetPaths[0].path;
    const changesetFile = changesetPaths[0].file;

    console.log(chalk.blue(`Modifying changeset: ${changesetFile}`));
    console.log("");

    // Build changeset content
    const changesetContent = `---
${publicPackages.map((pkg) => `"${pkg.name}": ${bumpType}`).join("\n")}
---

Snapshot release for ${tag} - automated bump
`;

    // Write the modified changeset content
    await fs.writeFile(changesetPath, changesetContent, "utf-8");

    console.log(chalk.green(`✅ Created changeset: ${changesetFile}`));
    console.log(chalk.blue(`   Bump type: ${bumpType}`));
    console.log(chalk.blue(`   Packages: ${publicPackages.length}`));
    console.log("");
    console.log(
      chalk.cyan(`Changeset file created at: .changeset/${changesetFile}`),
    );
    console.log("");

    // Run changeset version to bump all package versions with snapshot tag
    console.log(
      chalk.blue(`Running changeset version with snapshot tag: ${tag}`),
    );
    console.log("");
    await $`pnpm changeset version --snapshot ${tag}`;

    console.log("");
    console.log(chalk.green(`✅ Snapshot versions bumped successfully`));
    console.log(chalk.blue(`   Snapshot tag: ${tag}`));
  } catch (error) {
    console.error(chalk.red("Failed to create snapshot versions"));
    throw error;
  }
}

module.exports = {
  bumpSnapshot,
};
