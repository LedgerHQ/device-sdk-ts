// [tree] File tree: what must exist, which folders are allowed, how files are named.

import path from "node:path";

import { TEST_FILE } from "./workspace.mjs";

const SCRIPTS = ["build", "lint", "prettier", "typecheck", "test"];
const ROLE_FILES = [
  "package.json",
  "README.md",
  "eslint.config.mjs",
  "tsconfig.json",
  "tsconfig.prod.json",
  "vitest.config.mjs",
  "guardrails.config.mjs",
];
const FILE_CASE = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9-]+)*\.tsx?$/;
const FOLDER_CASE = /^([a-z0-9]+(-[a-z0-9]+)*|__[a-z0-9-]+__)$/;
const DEVICE_ACTION_FOLDER = /^[A-Z][A-Za-z0-9]*$/;

// `pkg` comes from readWorkspace(), with its loaded `config`.
// Returns { found, usedExtraFolders }.
export function checkTree(pkg, files) {
  const { role, extraFolders } = pkg.config;
  const found = [];
  const usedExtraFolders = new Set();
  const report = (rule, file, detail) => found.push({ rule, file, detail });
  const src = files.filter((file) => file.startsWith("src/"));
  const prod = src.filter((file) => !TEST_FILE.test(file));
  const hasFile = (file) => files.includes(file);
  const hasFolder = (dir) => files.some((file) => file.startsWith(`${dir}/`));

  checkPackageFiles(pkg, files, report);

  if (role.kind === "signer") {
    checkSignerRequired(prod, hasFile, hasFolder, report);
    checkNaming(role, prod, report);
    checkDeviceActions(role, src, report);
    checkCase(role, src, prod, report);
  } else if (role.kind === "transport") {
    checkTransportRequired(role, prod, hasFile, report);
  }

  if (role.tree.allowedFolders) {
    checkAllowedFolders(role, src, extraFolders, usedExtraFolders, report);
  }

  return { found, usedExtraFolders };
}

// tree/package-files for packages with a role.
function checkPackageFiles(pkg, files, report) {
  const required = pkg.isPrivate ? ROLE_FILES : [...ROLE_FILES, "CHANGELOG.md"];
  for (const file of required) {
    if (!files.includes(file))
      report("tree/package-files", file, `${file} is missing`);
  }
  for (const script of SCRIPTS) {
    if (!pkg.manifest.scripts?.[script]) {
      report(
        "tree/package-files",
        "package.json",
        `the "${script}" script is missing`,
      );
    }
  }
  const main = pkg.manifest.exports?.["."];
  if (!main?.types || !main?.import) {
    report(
      "tree/package-files",
      "package.json",
      `exports["."] needs at least "types" and "import"`,
    );
  }
}

// tree/package-files for published packages without a role: README and CHANGELOG.
export function checkGenericPackageFiles(pkg, files) {
  if (pkg.isPrivate) return [];
  return ["README.md", "CHANGELOG.md"]
    .filter((file) => !files.includes(file))
    .map((file) => ({
      rule: "tree/package-files",
      file,
      detail: `${file} is missing`,
    }));
}

function checkSignerRequired(prod, hasFile, hasFolder, report) {
  const missing = (file) => report("tree/required", file, `${file} is missing`);

  for (const file of [
    "src/index.ts",
    "src/api/index.ts",
    "src/internal/di.ts",
  ]) {
    if (!hasFile(file)) missing(file);
  }
  for (const dir of ["src/api/model", "src/internal/app-binder/command"]) {
    if (!hasFolder(dir)) missing(`${dir}/`);
  }

  // <X> is read from the Builder name.
  const builders = prod.filter((file) =>
    /^src\/api\/Signer[A-Za-z0-9]+Builder\.ts$/.test(file),
  );
  if (builders.length !== 1) {
    report(
      "tree/required",
      "src/api/",
      `expected exactly one src/api/Signer<X>Builder.ts, found ${builders.length}`,
    );
  } else {
    const x = builders[0].match(/Signer([A-Za-z0-9]+)Builder\.ts$/)[1];
    for (const file of [
      `src/api/Signer${x}.ts`,
      `src/internal/DefaultSigner${x}.ts`,
    ]) {
      if (!hasFile(file)) missing(file);
    }
  }

  // The AppBinder prefix may differ from <X> (SignerTrx pairs with TronAppBinder).
  const binders = prod.filter((file) =>
    /^src\/internal\/app-binder\/[A-Za-z0-9]+AppBinder\.ts$/.test(file),
  );
  if (binders.length !== 1) {
    report(
      "tree/required",
      "src/internal/app-binder/",
      `expected exactly one src/internal/app-binder/*AppBinder.ts, found ${binders.length}`,
    );
  }
}

// tree/command-name, tree/task-name: the top-level files of a folder end with a suffix.
function checkNaming(role, prod, report) {
  for (const { rule, dir, suffix } of role.tree.naming) {
    for (const file of prod) {
      if (path.posix.dirname(file) === dir && !file.endsWith(suffix)) {
        report(rule, file, `does not end with ${suffix}`);
      }
    }
  }
}

// tree/device-action-location: device-action/<Name>/<Name>DeviceAction.ts (and .types.ts).
// Factories, which pick the device action, may sit directly in device-action/.
function checkDeviceActions(role, src, report) {
  const dir = role.tree.deviceActionDir;
  for (const file of src) {
    if (!file.startsWith(`${dir}/`) || TEST_FILE.test(file)) continue;
    const rel = file.slice(dir.length + 1);
    const parts = rel.split("/");
    const ok =
      (parts.length === 1 && /DeviceActionFactory\.ts$/.test(rel)) ||
      (parts.length === 2 &&
        [
          `${parts[0]}DeviceAction.ts`,
          `${parts[0]}DeviceAction.types.ts`,
        ].includes(parts[1]));
    if (!ok) {
      report(
        "tree/device-action-location",
        file,
        "expected device-action/<Name>/<Name>DeviceAction.ts or device-action/<Name>DeviceActionFactory.ts",
      );
    }
  }
}

// tree/file-case (production files) and tree/folder-case (every folder).
function checkCase(role, src, prod, report) {
  for (const file of prod) {
    const name = path.posix.basename(file);
    if (/\.tsx?$/.test(name) && !FILE_CASE.test(name)) {
      report("tree/file-case", file, "is not in PascalCase or camelCase");
    }
  }
  const folders = new Set();
  for (const file of src) {
    const parts = path.posix.dirname(file).split("/");
    parts.forEach((_, i) => folders.add(parts.slice(0, i + 1).join("/")));
  }
  const deviceActionDir = role.tree.deviceActionDir;
  for (const folder of [...folders].sort()) {
    if (folder === "src") continue;
    const name = path.posix.basename(folder);
    const ok =
      path.posix.dirname(folder) === deviceActionDir
        ? DEVICE_ACTION_FOLDER.test(name) || FOLDER_CASE.test(name)
        : FOLDER_CASE.test(name);
    if (!ok) report("tree/folder-case", `${folder}/`, "is not in kebab-case");
  }
}

function checkTransportRequired(role, prod, hasFile, report) {
  if (!hasFile("src/index.ts"))
    report("tree/required", "src/index.ts", "src/index.ts is missing");

  const transports = prod.filter((file) =>
    /(^|\/)[A-Za-z0-9]+Transport\.ts$/.test(file),
  );
  if (transports.length !== 1) {
    report(
      "tree/required",
      "src/",
      `expected exactly one *Transport.ts, found ${transports.length}${transports.length ? `: ${transports.join(", ")}` : ""}`,
    );
    return;
  }
  if (!role.tree.webFamily) return;

  const x = transports[0].match(/([A-Za-z0-9]+)Transport\.ts$/)[1];
  for (const file of [
    "src/api/index.ts",
    `src/api/transport/${x}Transport.ts`,
    `src/api/transport/${x}ApduSender.ts`,
    "src/api/model/Errors.ts",
  ]) {
    if (!hasFile(file)) report("tree/required", file, `${file} is missing`);
  }
}

// tree/allowed-folders: at each listed level, only the role's folders plus the
// package's extraFolders. In the featureFolders variant, any other folder in
// src/internal is a feature, which may only contain the feature sub-folders.
function checkAllowedFolders(
  role,
  src,
  extraFolders,
  usedExtraFolders,
  report,
) {
  const extra = new Set(
    extraFolders.map((entry) => entry.path.replace(/\/$/, "")),
  );
  const childrenOf = (dir) =>
    [
      ...new Set(
        src
          .filter((file) => file.startsWith(`${dir}/`))
          .map((file) => file.slice(dir.length + 1).split("/"))
          .filter((parts) => parts.length > 1)
          .map((parts) => parts[0]),
      ),
    ].sort();
  const isAllowed = (dir, name, allowed) => {
    const folder = `${dir}/${name}`;
    if (allowed.includes(name) || /^__[a-z0-9-]+__$/.test(name)) return true;
    if (extra.has(folder)) {
      usedExtraFolders.add(folder);
      return true;
    }
    return false;
  };

  // Code directly in src/ would belong to no layer.
  if (role.tree.allowedFolders.src) {
    for (const file of src) {
      const loose = file.split("/").length === 2 && file !== "src/index.ts";
      if (loose && !TEST_FILE.test(file)) {
        report(
          "tree/allowed-folders",
          file,
          `src/ may only contain index.ts and ${role.tree.allowedFolders.src.join(", ")}`,
        );
      }
    }
  }

  for (const [dir, allowed] of Object.entries(role.tree.allowedFolders)) {
    for (const name of childrenOf(dir)) {
      if (isAllowed(dir, name, allowed)) continue;
      const feature = role.tree.featureFolders;
      if (feature && dir === "src/internal") {
        for (const child of childrenOf(`${dir}/${name}`)) {
          if (!isAllowed(`${dir}/${name}`, child, feature.children)) {
            report(
              "tree/allowed-folders",
              `${dir}/${name}/${child}/`,
              `a feature folder may only contain ${feature.children.join(", ")}`,
            );
          }
        }
        continue;
      }
      report(
        "tree/allowed-folders",
        `${dir}/${name}/`,
        `${dir}/ may only contain ${allowed.join(", ")}`,
      );
    }
  }
}
