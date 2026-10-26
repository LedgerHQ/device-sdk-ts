// Public entry point, imported by each package's guardrails.config.mjs:
//
//   import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";
//   export default defineGuardrails({ role: signerKit });

import { generic } from "./roles/generic.mjs";
import { signerKit } from "./roles/signerKit.mjs";
import { transport } from "./roles/transport.mjs";
import { isTreeRule, NOT_EXCEPTABLE, RULES } from "./rules.mjs";

export { generic, signerKit, transport };

const ROLES = [
  signerKit,
  signerKit.featureFolders,
  transport,
  transport.webFamily,
];
const KEYS = ["role", "extraFolders", "exceptions"];
const GLOB = /[*?[\]{}!]/;

export function defineGuardrails(config) {
  const problems = [];
  const where = "defineGuardrails()";

  for (const key of Object.keys(config ?? {})) {
    if (!KEYS.includes(key)) problems.push(`unknown field "${key}"`);
  }
  const role = ROLES.find((candidate) => candidate.name === config?.role?.name);
  if (!role) {
    problems.push(
      `"role" must be one of: ${ROLES.map((candidate) => candidate.name).join(", ")}`,
    );
  }

  const extraFolders = config?.extraFolders ?? [];
  const exceptions = config?.exceptions ?? [];
  if (!Array.isArray(extraFolders))
    problems.push(`"extraFolders" must be a list`);
  if (!Array.isArray(exceptions)) problems.push(`"exceptions" must be a list`);

  if (role && !role.tree.allowedFolders && listOrEmpty(extraFolders).length) {
    problems.push(
      `"extraFolders" needs a role that lists its folders, and ${role.name} doesn't`,
    );
  }
  listOrEmpty(extraFolders).forEach((entry, i) => {
    if (!isText(entry?.path))
      problems.push(`extraFolders[${i}] needs a "path"`);
    if (!isText(entry?.reason))
      problems.push(`extraFolders[${i}] needs a "reason"`);
  });
  listOrEmpty(exceptions).forEach((entry, i) => {
    if (!RULES[entry?.rule])
      problems.push(`exceptions[${i}] names an unknown rule "${entry?.rule}"`);
    else if (NOT_EXCEPTABLE.has(entry.rule))
      problems.push(`exceptions[${i}]: ${entry.rule} can't be excepted`);
    if (!isText(entry?.path)) problems.push(`exceptions[${i}] needs a "path"`);
    else if (
      RULES[entry.rule] &&
      !isTreeRule(entry.rule) &&
      GLOB.test(entry.path)
    )
      problems.push(
        `exceptions[${i}]: a [deps] or [layers] exception names one file, or "package.json#<dependency>", without wildcards`,
      );
    if (!isText(entry?.reason))
      problems.push(`exceptions[${i}] needs a "reason"`);
  });

  if (problems.length > 0) {
    throw new Error(`${where}: ${problems.join("; ")}`);
  }

  return Object.freeze({
    role,
    extraFolders,
    exceptions,
  });
}

function listOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}
