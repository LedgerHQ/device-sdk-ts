// Small fixture packages, written to a temporary folder by the tests.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { defineGuardrails, signerKit, transport } from "../index.mjs";

export const DMK = "@ledgerhq/device-management-kit";

export function kitManifest(overrides = {}) {
  return {
    name: "@ledgerhq/device-signer-kit-foo",
    version: "1.0.0",
    private: false,
    exports: {
      ".": { types: "./lib/types/index.d.ts", import: "./lib/esm/index.js" },
    },
    scripts: {
      build: "pnpm ldmk-tool build",
      guardrails: "pnpm ldmk-tool guardrails",
      lint: "eslint",
      prettier: "prettier . --check",
      typecheck: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: { "@ledgerhq/signer-utils": "workspace:^" },
    devDependencies: { [DMK]: "workspace:^" },
    peerDependencies: { [DMK]: "workspace:^" },
    ...overrides,
  };
}

const PACKAGE_FILES = {
  "README.md": "# Foo\n",
  "CHANGELOG.md": "# Changelog\n",
  "eslint.config.mjs": "export default [];\n",
  "tsconfig.prod.json": "{}\n",
  "vitest.config.mjs": "export default {};\n",
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: { "@api/*": ["./src/api/*"], "@internal/*": ["./src/internal/*"] },
    },
  }),
};

// A signer kit that passes every rule. Each layer imports the one below it.
export function goodKitFiles() {
  return {
    ...PACKAGE_FILES,
    "guardrails.config.mjs":
      'import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";\n\nexport default defineGuardrails({ role: signerKit });\n',
    "src/index.ts": 'export * from "@api/index";\n',
    "src/api/index.ts":
      'export { type SignerFoo } from "@api/SignerFoo";\nexport { SignerFooBuilder } from "@api/SignerFooBuilder";\nexport { type FooOptions } from "@api/model/FooOptions";\n',
    "src/api/SignerFoo.ts":
      'import { type FooOptions } from "@api/model/FooOptions";\nexport interface SignerFoo { getAddress(options: FooOptions): void }\n',
    "src/api/SignerFooBuilder.ts":
      'import { DefaultSignerFoo } from "@internal/DefaultSignerFoo";\nexport class SignerFooBuilder { build() { return new DefaultSignerFoo(); } }\n',
    "src/api/model/FooOptions.ts":
      "export type FooOptions = { path: string };\n",
    "src/internal/DefaultSignerFoo.ts":
      'import { makeContainer } from "@internal/di";\nexport class DefaultSignerFoo { container = makeContainer(); }\n',
    "src/internal/di.ts":
      'import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";\nexport const makeContainer = () => new GetAddressUseCase();\n',
    "src/internal/use-cases/address/GetAddressUseCase.ts":
      'import { FooAppBinder } from "@internal/app-binder/FooAppBinder";\nexport class GetAddressUseCase { binder = new FooAppBinder(); }\n',
    "src/internal/app-binder/FooAppBinder.ts":
      'import { GetAddressDeviceAction } from "@internal/app-binder/device-action/GetAddress/GetAddressDeviceAction";\nexport class FooAppBinder { action = new GetAddressDeviceAction(); }\n',
    "src/internal/app-binder/di/appBinderTypes.ts":
      'export const appBinderTypes = { AppBinder: Symbol.for("AppBinder") };\n',
    "src/internal/app-binder/device-action/GetAddress/GetAddressDeviceAction.ts":
      'import { SendTask } from "@internal/app-binder/task/SendTask";\nimport { type GetAddressDAOutput } from "./GetAddressDeviceAction.types";\nexport class GetAddressDeviceAction { task = new SendTask(); output?: GetAddressDAOutput; }\n',
    "src/internal/app-binder/device-action/GetAddress/GetAddressDeviceAction.types.ts":
      "export type GetAddressDAOutput = string;\n",
    "src/internal/app-binder/device-action/GetAddressDeviceActionFactory.ts":
      'import { GetAddressDeviceAction } from "./GetAddress/GetAddressDeviceAction";\nexport const make = () => new GetAddressDeviceAction();\n',
    "src/internal/app-binder/task/SendTask.ts":
      'import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";\nimport { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";\nexport class SendTask { command = new GetAddressCommand(); id = appBinderTypes.AppBinder; }\n',
    "src/internal/app-binder/command/GetAddressCommand.ts":
      'import { CLA } from "@internal/app-binder/command/utils/constants";\nimport { DMK_VERSION } from "@internal/app-binder/constants";\nexport class GetAddressCommand { cla = CLA; v = DMK_VERSION; }\n',
    "src/internal/app-binder/command/utils/constants.ts":
      "export const CLA = 0xe0;\n",
    "src/internal/app-binder/constants.ts": "export const DMK_VERSION = 1;\n",
    "src/internal/app-binder/command/GetAddressCommand.test.ts":
      'import { FooAppBinder } from "@internal/app-binder/FooAppBinder";\nexport const t = FooAppBinder;\n',
    "src/internal/shared/utils/hex.ts": `import { type DeviceActionState } from "${DMK}";\nexport const hex = (x: number): DeviceActionState | string => x.toString(16);\n`,
  };
}

// A web-family transport that passes every rule.
export function goodTransportFiles() {
  return {
    ...PACKAGE_FILES,
    "guardrails.config.mjs":
      'import { defineGuardrails, transport } from "@ledgerhq/ldmk-tool/guardrails";\n\nexport default defineGuardrails({ role: transport.webFamily });\n',
    "src/index.ts": 'export * from "@api/index";\n',
    "src/api/index.ts":
      'export { WebFooTransport } from "@api/transport/WebFooTransport";\n',
    "src/api/transport/WebFooTransport.ts":
      'import { WebFooApduSender } from "@api/transport/WebFooApduSender";\nimport { FooError } from "@api/model/Errors";\nexport class WebFooTransport { sender = new WebFooApduSender(); e = FooError; }\n',
    "src/api/transport/WebFooApduSender.ts":
      "export class WebFooApduSender {}\n",
    "src/api/model/Errors.ts": "export class FooError extends Error {}\n",
  };
}

export function makeTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "guardrails-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function writeFiles(dir, files) {
  for (const [file, content] of Object.entries(files)) {
    const abs = path.join(dir, file);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

// A workspace package object, as readWorkspace() and loadConfig() build it.
export function makePackage({
  dir = "packages/signer/signer-foo",
  absDir = dir,
  manifest = kitManifest(),
  group = "signerKit",
  config = defineGuardrails({ role: signerKit }),
} = {}) {
  return {
    dir,
    absDir,
    name: manifest.name,
    manifest,
    isPrivate: manifest.private === true,
    group,
    config: {
      ...config,
      file: config.role.group ? `${dir}/guardrails.config.mjs` : null,
    },
  };
}

export const webTransportConfig = () =>
  defineGuardrails({ role: transport.webFamily });
