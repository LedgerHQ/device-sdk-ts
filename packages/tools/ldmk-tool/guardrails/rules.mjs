// Every rule the guardrails can report, with the text shown in the error message.
// The id prefix is the part's tag: [deps] Dependencies, [layers] Layers, [tree] File tree.

export const DOCS_PATH = "packages/tools/ldmk-tool/guardrails/README.md";

export const RULES = {
  // [deps] Dependencies
  "deps/group-declared": {
    why: "Every package must belong to a group, so that no package can skip the dependency rules.",
    fix: "Add the package path to ldmk-tool/guardrails/groups.mjs. Signer kits and transports also need a guardrails.config.mjs.",
  },
  "deps/edge-allowed": {
    why: "Kits are independent plugins, transports don't know about blockchains, and nothing depends on an app.",
    fix: "Remove the dependency, or move the shared code to a package this group may depend on (see the allowed-edges table).",
  },
  "deps/core-is-peer": {
    why: "The app and all its kits must share one instance of the Device Management Kit.",
    fix: "Declare @ledgerhq/device-management-kit in peerDependencies and devDependencies, never in dependencies.",
  },
  "deps/no-duplicate-kind": {
    why: "A package listed both as a dependency and as a peer dependency installs ambiguously.",
    fix: "Keep it in one place: dependencies, or peerDependencies + devDependencies.",
  },
  "deps/context-module-kind": {
    why: "Signer kits declare @ledgerhq/context-module in one of the two forms in use today, never a mix of both.",
    fix: "Use either dependencies only (like signer-solana), or peerDependencies + devDependencies (like signer-eth).",
  },
  "deps/no-public-to-private": {
    why: "A published package can't be installed if it needs a private one at runtime.",
    fix: "Make the dependency a devDependency, publish the dependency, or remove it.",
  },
  "deps/no-cycles": {
    why: "Workspace packages must build and release in a single order.",
    fix: "Break the cycle by moving the shared code to a lower package.",
  },
  "deps/declared": {
    why: "An undeclared import only works by accident, because of hoisting.",
    fix: "Add the package to dependencies, peerDependencies or devDependencies.",
  },
  "deps/no-deep": {
    why: "Another package's internal files can change at any time.",
    fix: "Import from the package root, and export what you need from its public API.",
  },

  // [layers] Layers
  "layers/index-only-api": {
    why: "What a package makes public is decided in one place: src/api/index.ts.",
    fix: 'Make src/index.ts contain only `export * from "@api/index";`.',
  },
  "layers/api-internal-type-only": {
    why: "Consumers must not come to depend on the implementation. Only the Builder creates internal classes.",
    fix: "Import the internal file with `import { type X }`, or move the value to src/api/.",
  },
  "layers/ladder": {
    why: "Changes travel in one direction, and the lower layers can be tested alone.",
    fix: "Import only from the layers below: DefaultSigner → use cases → app binder → device actions → tasks → commands.",
  },
  "layers/command-is-leaf": {
    why: "Commands are the lowest layer: one self-contained APDU class each.",
    fix: "Move what the command needs to src/internal/app-binder/command/utils/, or into the command itself.",
  },
  "layers/command-no-command": {
    why: "Commands are dumb and self-contained: one APDU, one class.",
    fix: "Copy what you need into the command, or move the shared part to command/utils/.",
  },
  "layers/no-circular": {
    why: "Code in a runtime import cycle can't be understood, loaded or changed piece by piece.",
    fix: "Break the cycle. Often it's a type imported without the `type` keyword, or an import from a barrel such as @api/index.",
  },
  "layers/internal-not-exported": {
    why: "Only the transport and its factory are public. src/internal/ stays private.",
    fix: "Move the exported file to src/api/, or stop exporting it.",
  },

  // [tree] File tree
  "tree/required": {
    why: "Anyone can find their way around any package when the entry points are always in the same place.",
    fix: "Create the missing file, or rename the existing one to the expected name.",
  },
  "tree/allowed-folders": {
    why: "A new structure should show up in review instead of slipping in.",
    fix: "Move the code to an allowed folder, or add the folder to extraFolders in guardrails.config.mjs, with a reason.",
  },
  "tree/command-name": {
    why: "The file name tells you the layer.",
    fix: "Name the file <Name>Command.ts, or move it to command/utils/.",
  },
  "tree/task-name": {
    why: "The file name tells you the layer.",
    fix: "Name the file <Name>Task.ts, or move it to task/utils/.",
  },
  "tree/device-action-location": {
    why: "Each flow keeps its machine, types and tests together.",
    fix: "Use device-action/<Name>/<Name>DeviceAction.ts (and .types.ts). Factories may sit directly in device-action/.",
  },
  "tree/file-case": {
    why: "Consistent names, and no case-sensitivity surprises in CI.",
    fix: "Name .ts files in PascalCase or camelCase.",
  },
  "tree/folder-case": {
    why: "Consistent names, and no case-sensitivity surprises in CI.",
    fix: "Name folders in kebab-case. Device-action folders use the PascalCase name of their device action.",
  },
  "tree/package-files": {
    why: "Every package builds, tests and publishes the same way.",
    fix: "Add the missing file, script or export. Copy it from a package with the same role.",
  },
};

// The tag printed before a rule id: "layers/no-circular" → "[layers]".
export function tagOf(ruleId) {
  return `[${ruleId.split("/")[0]}]`;
}

// GitHub turns the heading "deps/no-deep" into the anchor "depsno-deep".
export function docsLink(ruleId) {
  return `${DOCS_PATH}#${ruleId.replace("/", "")}`;
}
