// One formatter for all checks. The output is sorted, so two runs print the same text.

import { styleText } from "node:util";

import { docsLink, RULES, tagOf } from "./rules.mjs";

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const location = (v) => `${v.file ?? ""}${v.line ? `:${v.line}` : ""}`;

// `results`: [{ dir, name, role, errors, warnings, exceptions }]
export function formatReport(results) {
  const lines = [];
  let errors = 0;
  let warnings = 0;
  let exceptions = 0;

  for (const result of [...results].sort((a, b) => byText(a.dir, b.dir))) {
    errors += result.errors.length;
    warnings += result.warnings.length;
    exceptions += result.exceptions;
    const title = `${result.name}  (role: ${result.role})`;
    const extra = result.exceptions
      ? ` · ${result.exceptions} exception${result.exceptions > 1 ? "s" : ""}`
      : "";

    if (result.errors.length === 0) {
      lines.push(`${styleText("green", "✔")} ${title}${extra}`);
    } else {
      if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
      lines.push(
        `${styleText("red", "✖")} ${styleText("bold", title)}${extra}`,
      );
      const rules = [...new Set(result.errors.map((v) => v.rule))].sort(byText);
      for (const rule of rules) {
        lines.push("", `  ${tagOf(rule)} ${styleText("bold", rule)}`);
        const violations = result.errors
          .filter((v) => v.rule === rule)
          .sort(
            (a, b) =>
              byText(location(a), location(b)) || byText(a.detail, b.detail),
          );
        for (const v of violations) {
          lines.push(`    ${location(v)}`, `      ${v.detail}`);
        }
        lines.push(
          `    Why:  ${RULES[rule].why}`,
          `    Fix:  ${RULES[rule].fix}`,
          `    Docs: ${docsLink(rule)}`,
        );
      }
      lines.push("");
    }
    for (const warning of [...result.warnings].sort(byText)) {
      lines.push(`  ${styleText("yellow", "⚠")} ${warning}`);
    }
  }

  lines.push(
    "",
    `${errors} error${errors === 1 ? "" : "s"} · ${warnings} warning${warnings === 1 ? "" : "s"} · ${exceptions} exception${exceptions === 1 ? "" : "s"}`,
  );
  return { text: lines.join("\n"), errors, warnings, exceptions };
}

// GitHub Actions annotations, so failures show up inline in the PR diff.
// GitHub shows only the first 10 errors of a step, so only the files the PR
// changed (`changed`, repo-relative) are annotated, when they are known.
export function formatAnnotations(results, changed = null) {
  const isChanged = (file) =>
    changed === null ||
    changed.some((path) => path === file || path.startsWith(`${file}/`));
  const escape = (text) =>
    String(text)
      .replace(/%/g, "%25")
      .replace(/\r/g, "%0D")
      .replace(/\n/g, "%0A");
  const lines = [];
  for (const result of results) {
    for (const v of result.errors) {
      const file = v.file
        ? `${result.dir}/${v.file}`.replace(/\/$/, "")
        : result.dir;
      if (!isChanged(file)) continue;
      const props = [
        `file=${file}`,
        v.line ? `line=${v.line}` : null,
        `title=${v.rule}`,
      ]
        .filter(Boolean)
        .join(",");
      lines.push(
        `::error ${props}::${escape(`${v.detail}. ${RULES[v.rule].fix}`)}`,
      );
    }
    for (const warning of result.warnings) {
      lines.push(
        `::warning file=${result.dir}/guardrails.config.mjs::${escape(warning)}`,
      );
    }
  }
  return lines.join("\n");
}
