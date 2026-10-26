import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DOCS_PATH, RULES, tagOf } from "../rules.mjs";

const docs = readFileSync(
  new URL(`../../../../../${DOCS_PATH}`, import.meta.url),
  "utf8",
);

describe("rules", () => {
  it.each(Object.keys(RULES))(
    "%s has a tag, a why, a fix and a docs section",
    (rule) => {
      expect(["[deps]", "[layers]", "[tree]"]).toContain(tagOf(rule));
      expect(RULES[rule].why.length).toBeGreaterThan(0);
      expect(RULES[rule].fix.length).toBeGreaterThan(0);
      expect(docs).toContain(`\n### ${rule}\n`);
    },
  );
});
