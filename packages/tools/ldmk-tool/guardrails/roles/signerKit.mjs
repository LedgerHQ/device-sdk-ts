// The signerKit role: packages/signer/signer-*, except signer-utils.

// [layers] Layers. A file belongs to the first layer whose paths match it.
const layers = [
  ["index", ["src/index.ts"]],
  ["api", ["src/api/**"]],
  ["command", ["src/internal/app-binder/command/**"]],
  ["task", ["src/internal/app-binder/task/**"]],
  ["device-action", ["src/internal/app-binder/device-action/**"]],
  [
    "app-binder",
    ["src/internal/app-binder/*AppBinder.ts", "src/internal/app-binder/di/**"],
  ],
  [
    "service",
    [
      "src/internal/app-binder/services/**",
      "src/internal/services/**",
      "src/internal/*/service/**",
      "src/internal/*/services/**",
    ],
  ],
  [
    "use-cases",
    [
      "src/internal/use-cases/**",
      "src/internal/*/use-case/**",
      "src/internal/*/use-cases/**",
    ],
  ],
  [
    "DefaultSigner",
    [
      "src/internal/DefaultSigner*.ts",
      "src/internal/di.ts",
      "src/internal/*Module.ts",
      "src/internal/*/di/**",
    ],
  ],
  ["domain", ["src/internal/**"]],
];

// Top → bottom. A layer may import the layers below it, never the layers above it.
const ladder = [
  "DefaultSigner",
  "use-cases",
  "app-binder",
  "device-action",
  "task",
  "command",
];

const signerKitBase = {
  name: "signerKit",
  group: "signerKit",
  kind: "signer",
  layers,
  ladder,
  // Files that hold DI identifiers (Symbol.for(...)). Any layer above command/ may import them.
  diTokens: ["src/**/di/*Types.ts"],
  // api/ files that may import internal/ as values: they build the implementation.
  apiMayCreate: [
    "src/api/Signer*Builder.ts",
    "src/api/index.ts",
    "src/api/**/*Factory.ts",
  ],
  tree: {
    allowedFolders: {
      src: ["api", "internal"],
      "src/api": ["app-binder", "model"],
      "src/internal": ["app-binder", "use-cases", "shared", "utils"],
      "src/internal/app-binder": [
        "command",
        "task",
        "device-action",
        "di",
        "services",
        "utils",
      ],
    },
    naming: [
      {
        rule: "tree/command-name",
        dir: "src/internal/app-binder/command",
        suffix: "Command.ts",
      },
      {
        rule: "tree/task-name",
        dir: "src/internal/app-binder/task",
        suffix: "Task.ts",
      },
    ],
    deviceActionDir: "src/internal/app-binder/device-action",
    featureFolders: null,
  },
};

// Variant for kits organised by feature (signer-eth):
// src/internal/<feature>/{use-case,di,service,model} replaces src/internal/use-cases/.
const featureFolders = {
  ...signerKitBase,
  name: "signerKit.featureFolders",
  tree: {
    ...signerKitBase.tree,
    allowedFolders: {
      ...signerKitBase.tree.allowedFolders,
      "src/internal": ["app-binder", "shared", "utils"],
    },
    featureFolders: { children: ["use-case", "di", "service", "model"] },
  },
};

export const signerKit = Object.freeze({
  ...signerKitBase,
  featureFolders: Object.freeze(featureFolders),
});
