// The generic role: every package without its own guardrails.config.mjs.
// Only [deps] on package.json runs for it, plus README and CHANGELOG for published packages.
export const generic = Object.freeze({
  name: "generic",
  group: null,
  kind: "generic",
  tree: {},
});
