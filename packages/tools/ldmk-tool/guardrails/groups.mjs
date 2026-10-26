// Places every workspace package in a group, by path. The first matching group wins.
// [deps] Dependencies uses the groups to decide which package may depend on which (see edges.mjs).
export const GROUPS = [
  ["core", ["packages/device-management-kit"]],
  [
    "signerSupport",
    [
      "packages/signer/signer-utils",
      "packages/signer/context-module",
      "packages/device-contacts-kit",
    ],
  ],
  ["signerKit", ["packages/signer/signer-*"]],
  ["transport", ["packages/transport/*"]],
  ["trustedApp", ["packages/trusted-apps/*", "packages/ledger-wallet"]],
  [
    "testInfra",
    ["packages/mockserver-*", "packages/speculos-device-controller"],
  ],
  ["devtools", ["packages/devtools/*"]],
  ["ui", ["packages/ui"]],
  ["tooling", ["packages/tools/*"]],
  ["config", ["packages/config/*"]],
  ["app", ["apps/*"]],
];

// Groups whose packages must have their own guardrails.config.mjs.
export const ROLE_GROUPS = ["signerKit", "transport"];
