// eslint-disable-next-line @typescript-eslint/no-require-imports
const withNextra = require("nextra")({
  defaultShowCopyCode: true,
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
});

module.exports = withNextra();
