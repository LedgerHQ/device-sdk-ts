#!/usr/bin/env zx

require("zx/globals");
const { canonicalizePackageJson } = require("./canonicalize.cjs");

/**
 * Pack all public packages in the workspace
 * @param {string} packagesDir - Directory containing packages (default: packages)
 * @param {string} distDir - Output directory for packed files (default: dist)
 */
const pack = async (packagesDir = "packages", distDir = "dist") => {
  try {
    const PROJECT_ROOT = process.cwd();
    const PACKAGES_DIR = path.join(PROJECT_ROOT, packagesDir);
    const DIST_DIR = path.join(PROJECT_ROOT, distDir);

    console.log(
      chalk.blue(`📦 Packing packages from ${packagesDir}/ to ${distDir}/`),
    );
    console.log("");

    // Check if packages directory exists
    if (!(await fs.pathExists(PACKAGES_DIR))) {
      throw new Error(`Packages directory not found: ${PACKAGES_DIR}`);
    }

    // Find all package.json files in the packages directory
    const result = await $`find ${PACKAGES_DIR} -name "package.json" \
      -not -path "*/node_modules/*" \
      -not -path "*/lib/*" \
      -not -path "*/dist/*" \
      -not -path "*/.turbo/*" \
      -not -path "*/coverage/*"`;

    const files = result.stdout.trim().split("\n").filter(Boolean);

    console.log(chalk.blue(`Found ${files.length} package(s)`));
    console.log("");

    // Create dist directory
    await fs.mkdir(DIST_DIR, { recursive: true });

    let packedCount = 0;
    let skippedCount = 0;

    for (const pkgFile of files) {
      const pkgDir = path.dirname(pkgFile);
      const pkgRelativePath = path.relative(PROJECT_ROOT, pkgFile);

      const content = await fs.readFile(pkgFile, "utf-8");
      const pkgJson = JSON.parse(content);

      // Skip private packages
      if (pkgJson.private === true) {
        console.log(
          chalk.gray(`Skipping ${pkgJson.name || pkgRelativePath} (private)`),
        );
        skippedCount++;
        continue;
      }

      console.log(chalk.cyan(`Packing ${pkgJson.name || pkgRelativePath}...`));

      // Canonicalize the package.json file
      const canonicalized = canonicalizePackageJson(pkgJson);
      await fs.writeFile(pkgFile, canonicalized, "utf-8");

      // Pack the package to dist directory
      await $`cd ${pkgDir} && pnpm pack --pack-destination ${DIST_DIR}`;

      packedCount++;
      console.log(chalk.green(`✓ Packed ${pkgJson.name}`));
      console.log("");
    }

    console.log(chalk.green(`Packing complete`));
    console.log(chalk.blue(`   ${packedCount} package(s) packed`));
    if (skippedCount > 0) {
      console.log(
        chalk.gray(`   ${skippedCount} package(s) skipped (private)`),
      );
    }
    console.log(chalk.blue(`   Output: ${distDir}/`));
  } catch (error) {
    console.error(chalk.red("Packing failed"));
    throw error;
  }
};

module.exports = {
  pack,
};
