// Public entry point, imported by each package's guardrails.config.mjs:
//
//   import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";
//   export default defineGuardrails({ role: signerKit });

import { generic } from "./roles/generic.mjs";
import { signerKit } from "./roles/signerKit.mjs";
import { transport } from "./roles/transport.mjs";
import { RULES } from "./rules.mjs";

export { generic, signerKit, transport };

const ROLES = [
  signerKit,
  signerKit.featureFolders,
  transport,
  transport.webFamily,
];
const KEYS = ["role", "extraFolders", "exceptions"];

export function defineGuardrails(config) {
  const problems = [];
  const where = "defineGuardrails()";

  for (const key of Object.keys(config ?? {})) {
    if (!KEYS.includes(key)) problems.push(`unknown field "${key}"`);
  }
  if (!ROLES.some((role) => role.name === config?.role?.name)) {
    problems.push(
      `"role" must be one of: ${ROLES.map((role) => role.name).join(", ")}`,
    );
  }

  const extraFolders = config?.extraFolders ?? [];
  const exceptions = config?.exceptions ?? [];
  if (!Array.isArray(extraFolders))
    problems.push(`"extraFolders" must be a list`);
  if (!Array.isArray(exceptions)) problems.push(`"exceptions" must be a list`);

  listOrEmpty(extraFolders).forEach((entry, i) => {
    if (!isText(entry?.path))
      problems.push(`extraFolders[${i}] needs a "path"`);
    if (!isText(entry?.reason))
      problems.push(`extraFolders[${i}] needs a "reason"`);
  });
  listOrEmpty(exceptions).forEach((entry, i) => {
    if (!RULES[entry?.rule])
      problems.push(`exceptions[${i}] names an unknown rule "${entry?.rule}"`);
    if (!isText(entry?.path)) problems.push(`exceptions[${i}] needs a "path"`);
    if (!isText(entry?.reason))
      problems.push(`exceptions[${i}] needs a "reason"`);
  });

  if (problems.length > 0) {
    throw new Error(`${where}: ${problems.join("; ")}`);
  }

  return Object.freeze({
    role: ROLES.find((role) => role.name === config.role.name),
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
