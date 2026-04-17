#!/usr/bin/env zx

require("zx/globals");
const { DISPLAY_NAMES, getWorkspacePackages, ROOT } = require("./config.cjs");

async function main() {
  const pkgs = await getWorkspacePackages();
  const publicPkgs = pkgs.filter((p) => !p.private);

  console.log(chalk.blue(`Found ${publicPkgs.length} public package(s)`));

  let dmkVersions = "";
  let signerKitVersions = "";
  let transportKitVersions = "";
  let otherVersions = "";
  const titleParts = [];

  for (const pkg of publicPkgs) {
    const displayName = DISPLAY_NAMES[pkg.name];
    if (!displayName) {
      console.error(
        chalk.red(
          `Package ${pkg.name} has no display name mapping in config.cjs`,
        ),
      );
      process.exit(1);
    }

    const line = `- **${displayName}**: ${pkg.version}\n`;
    titleParts.push(`${displayName} ${pkg.version}`);

    if (pkg.name === "@ledgerhq/device-management-kit") {
      dmkVersions += line;
    } else if (
      pkg.name.includes("@ledgerhq/device-signer-kit-") ||
      pkg.name === "@ledgerhq/context-module" ||
      pkg.name === "@ledgerhq/signer-utils"
    ) {
      signerKitVersions += line;
    } else if (pkg.name.includes("@ledgerhq/device-transport-kit-")) {
      transportKitVersions += line;
    } else {
      otherVersions += line;
    }
  }

  const templatePath = path.join(
    ROOT,
    ".github/pull_request_release_template.md",
  );
  const template = await fs.readFile(templatePath, "utf-8");

  let body = template.split("<!-- Release information -->")[0];
  if (dmkVersions) body += `### DMK\n\n${dmkVersions}\n`;
  if (signerKitVersions)
    body += `### Signer Kits\n\n${signerKitVersions}\n`;
  if (transportKitVersions)
    body += `### Transport Kits\n\n${transportKitVersions}\n`;
  if (otherVersions) body += `### Other Packages\n\n${otherVersions}`;
  body += template.split("<!-- End Release information -->\n")[1];

  const titleVersions =
    titleParts.length > 0 ? titleParts.join(", ") : "No packages to release";
  const prTitle = `🔖 (release) [NO-ISSUE]: New release incoming: ${titleVersions}`;

  const bodyFile = path.join(os.tmpdir(), `pr-body-${Date.now()}.md`);
  await fs.writeFile(bodyFile, body);

  try {
    const result =
      await $`gh pr create -B main --title ${prTitle} --body-file ${bodyFile}`;
    console.log(chalk.green(result.stdout.trim()));
  } catch (e) {
    console.error(chalk.red("Failed to create PR:"), e.stderr || e.message);
    process.exit(1);
  } finally {
    await fs.remove(bodyFile);
  }
}

main();
