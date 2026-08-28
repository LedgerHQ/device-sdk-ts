#!/usr/bin/env zx

require("zx/globals");
const {
  CHANGESET_DIR,
  PKG_NAME,
  fail,
  pendingChangesets,
} = require("./common.cjs");

const ENTRY_RE = new RegExp(
  `^[ \\t]*"?${PKG_NAME}"?:[ \\t]*(patch|minor|major)[ \\t]*\\n`,
  "m",
);

async function main() {
  const changesets = await pendingChangesets();

  if (changesets.length === 0) {
    console.log(chalk.yellow(`No changeset for ${PKG_NAME} to clean up.`));
    console.log(JSON.stringify({ deleted: [], stripped: [] }, null, 2));
    return;
  }

  const deleted = [];
  const stripped = [];

  for (const cs of changesets) {
    const filePath = path.join(CHANGESET_DIR, cs.file);

    // Danger enforces one package per changeset, but a mixed file must not
    // take another package's pending release down with it.
    if (cs.otherPackages.length > 0) {
      const content = await fs.readFile(filePath, "utf-8");
      const next = content.replace(ENTRY_RE, "");
      if (next === content) {
        throw new Error(
          `Could not strip the ${PKG_NAME} entry from .changeset/${cs.file}. Edit it by hand.`,
        );
      }
      await fs.writeFile(filePath, next);
      stripped.push(cs.file);
      console.log(
        chalk.yellow(
          `Stripped ${PKG_NAME} from .changeset/${cs.file} (also covers ${cs.otherPackages.join(", ")})`,
        ),
      );
      continue;
    }

    await fs.remove(filePath);
    deleted.push(cs.file);
    console.log(chalk.gray(`Deleted .changeset/${cs.file}`));
  }

  console.log(
    chalk.green(
      `Removed ${deleted.length} changeset file(s)` +
        (stripped.length ? `, edited ${stripped.length} mixed file(s).` : "."),
    ),
  );
  console.log(JSON.stringify({ deleted, stripped }, null, 2));
}

main().catch(fail);
