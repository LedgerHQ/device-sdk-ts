#!/usr/bin/env zx
require("zx/globals");

/**
 * Mapping of package names to their display names
 */
const PACKAGE_DISPLAY_NAMES = {
  "@ledgerhq/device-management-kit": "DMK",
  "@ledgerhq/device-management-kit-flipper-plugin-client":
    "Flipper Plugin Client",
  "@ledgerhq/device-mockserver-client": "Mockserver Client",
  "@ledgerhq/context-module": "Context Module",
  "@ledgerhq/device-signer-kit-bitcoin": "Signer BTC",
  "@ledgerhq/device-signer-kit-ethereum": "Signer ETH",
  "@ledgerhq/device-signer-kit-solana": "Signer SOL",
  "@ledgerhq/signer-utils": "Signer Utils",
  "@ledgerhq/speculos-device-controller": "Speculos Device Controller",
  "@ledgerhq/device-transport-kit-mockserver": "Transport Mockserver",
  "@ledgerhq/device-transport-kit-react-native-ble": "Transport RN BLE",
  "@ledgerhq/device-transport-kit-react-native-hid": "Transport RN HID",
  "@ledgerhq/device-transport-kit-speculos": "Transport Speculos",
  "@ledgerhq/device-transport-kit-web-ble": "Transport Web BLE",
  "@ledgerhq/device-transport-kit-web-hid": "Transport Web HID",
  "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol":
    "Keyring Protocol",
  "@ledgerhq/device-management-kit-ui": "DMK UI",
};

/**
 * Create a release PR
 */
const createReleasePullRequest = async () => {
  const PROJECT_ROOT = process.cwd();
  const PACKAGES_DIR = path.join(PROJECT_ROOT, "packages");

  console.log(chalk.blue(`Creating release pull request`));

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

  const packageFiles = result.stdout.trim().split("\n").filter(Boolean);

  // filter only public packages
  const publicPackageFiles = [];
  for (const file of packageFiles) {
    const content = await fs.readFile(file, "utf-8");
    const pkgJson = JSON.parse(content);
    if (pkgJson.private !== true) {
      publicPackageFiles.push(file);
    }
  }

  console.log(
    chalk.blue(`Found ${publicPackageFiles.length} public package(s)`),
  );

  let signerKitVersions = "";
  let transportKitVersions = "";
  let dmkVersions = "";
  let otherVersions = "";
  let titleVersions = "";

  for (const pkgFile of publicPackageFiles) {
    const pkgJson = JSON.parse(await fs.readFile(pkgFile, "utf-8"));
    console.log(chalk.cyan(`- ${pkgJson.name}`));

    const displayName = PACKAGE_DISPLAY_NAMES[pkgJson.name];
    if (!displayName) {
      console.error(
        chalk.red(`Package ${pkgJson.name} has no display name mapping`),
      );
      process.exit(1);
    }

    if (pkgJson.name === "@ledgerhq/device-management-kit") {
      dmkVersions += `- **${displayName}**: ${pkgJson.version}\n`;
      titleVersions += `${displayName} ${pkgJson.version}, `;
    } else if (
      pkgJson.name.includes("@ledgerhq/device-signer-kit-") ||
      pkgJson.name === "@ledgerhq/context-module" ||
      pkgJson.name === "@ledgerhq/signer-utils"
    ) {
      signerKitVersions += `- **${displayName}**: ${pkgJson.version}\n`;
      titleVersions += `${displayName} ${pkgJson.version}, `;
    } else if (pkgJson.name.includes("@ledgerhq/device-transport-kit-")) {
      transportKitVersions += `- **${displayName}**: ${pkgJson.version}\n`;
      titleVersions += `${displayName} ${pkgJson.version}, `;
    } else {
      otherVersions += `- **${displayName}**: ${pkgJson.version}\n`;
      titleVersions += `${displayName} ${pkgJson.version}, `;
    }
  }

  const prTemplate = await fs.readFile(
    path.join(PROJECT_ROOT, ".github/pull_request_release_template.md"),
    "utf-8",
  );

  let prDescription = "";
  prDescription += prTemplate.split("<!-- Release information -->")[0];
  if (dmkVersions.length > 0) prDescription += `### DMK\n\n${dmkVersions}\n`;
  if (signerKitVersions.length > 0)
    prDescription += `### Signer Kits\n\n${signerKitVersions}\n`;
  if (transportKitVersions.length > 0)
    prDescription += `### Transport Kits\n\n${transportKitVersions}\n`;
  if (otherVersions.length > 0)
    prDescription += `### Other Packages\n\n${otherVersions}`;
  prDescription += prTemplate.split("<!-- End Release information -->\n")[1];
  prDescription = prDescription.replaceAll("'", "\\'");

  titleVersions =
    titleVersions.length > 0
      ? titleVersions.slice(0, -2)
      : "No packages to release";

  const prTitle = `🔖 (release) [NO-ISSUE]: New release incoming: ${titleVersions}`;
  const bodyFile = path.join(os.tmpdir(), "pr-body.md");
  await fs.writeFile(bodyFile, prDescription);
  const ghResult =
    await $`gh pr create -B main --title ${prTitle} --body-file ${bodyFile}`;
  await fs.unlink(bodyFile);

  if (ghResult.exitCode !== 0) {
    console.error(chalk.red(ghResult.stderr));
    process.exit(1);
  }
};

module.exports = {
  createReleasePullRequest,
};
