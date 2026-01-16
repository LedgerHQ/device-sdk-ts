#!/usr/bin/env zx

require("zx/globals");

/**
 * Canonicalize a package.json content by sorting all keys recursively
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeys(item));
  }

  const sorted = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }

  return sorted;
}

/**
 * Canonicalize a package.json object by sorting all keys recursively
 * @param {object} pkgJson - Already parsed package.json object
 */
function canonicalizePackageJson(pkgJson) {
  const sorted = sortObjectKeys(pkgJson);
  return JSON.stringify(sorted, null, 2) + "\n";
}

/**
 * Canonicalize all package.json files in the workspace
 * @param {string} packagesDir - Directory containing packages (default: packages)
 * @param {boolean} checkOnly - If true, only check if files need canonicalization without modifying them
 */
const canonicalize = async (packagesDir = "packages", checkOnly = false) => {
  try {
    const PROJECT_ROOT = process.cwd();
    const PACKAGES_DIR = path.join(PROJECT_ROOT, packagesDir);

    console.log(
      chalk.blue(
        `🔧 ${checkOnly ? "Checking" : "Canonicalizing"} package.json files in ${packagesDir}/`,
      ),
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

    console.log(chalk.blue(`Found ${files.length} package.json file(s)`));
    console.log("");

    let modifiedCount = 0;
    let upToDateCount = 0;
    let needsCanonicalizationFiles = [];

    for (const pkgFile of files) {
      const pkgRelativePath = path.relative(PROJECT_ROOT, pkgFile);

      const content = await fs.readFile(pkgFile, "utf-8");
      const pkgJson = JSON.parse(content);

      // Canonicalize the content
      const canonicalized = canonicalizePackageJson(pkgJson);

      if (content !== canonicalized) {
        if (checkOnly) {
          console.log(
            chalk.yellow(
              `⚠ ${pkgJson.name || pkgRelativePath} needs canonicalization`,
            ),
          );
          needsCanonicalizationFiles.push(pkgRelativePath);
        } else {
          console.log(
            chalk.cyan(`Canonicalizing ${pkgJson.name || pkgRelativePath}...`),
          );
          await fs.writeFile(pkgFile, canonicalized, "utf-8");
          console.log(chalk.green(`✓ Canonicalized ${pkgJson.name}`));
          modifiedCount++;
        }
      } else {
        console.log(
          chalk.gray(`${pkgJson.name || pkgRelativePath} is already canonical`),
        );
        upToDateCount++;
      }
      console.log("");
    }

    if (checkOnly) {
      console.log(chalk.blue(`Check complete`));
      console.log(chalk.blue(`   ${upToDateCount} file(s) already canonical`));
      if (needsCanonicalizationFiles.length > 0) {
        console.log(
          chalk.yellow(
            `   ${needsCanonicalizationFiles.length} file(s) need canonicalization`,
          ),
        );
        console.log("");
        console.log(
          chalk.yellow(`Run 'pnpm ldmk-tool canonicalize' to fix these files.`),
        );
        process.exit(1);
      }
    } else {
      console.log(chalk.green(`Canonicalization complete`));
      console.log(chalk.blue(`   ${modifiedCount} file(s) modified`));
      console.log(chalk.blue(`   ${upToDateCount} file(s) unchanged`));
    }
  } catch (error) {
    console.error(chalk.red("Canonicalization failed"));
    throw error;
  }
};

module.exports = {
  canonicalize,
  sortObjectKeys,
  canonicalizePackageJson,
};
