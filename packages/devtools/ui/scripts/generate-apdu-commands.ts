import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";
import ts from "typescript";

const PACKAGES_DIR = fileURLToPath(new URL("../../../", import.meta.url));
export const OUT_FILE = fileURLToPath(
  new URL("../src/screens/inspector/apduCommands.ts", import.meta.url),
);

// CLA b0 is answered by every app the same way (the app SDK handles it), whatever app is open
const COMMON_CLA = 0xb0;

type CommandSource = {
  /** Where the commands live, relative to `packages/`. */
  dir: string;
  /** Apps whose commands these are; null for the dashboard. */
  apps: string[] | null;
};

const sourceFiles = new Map<string, ts.SourceFile>();
const sourceFile = (file: string) => {
  let source = sourceFiles.get(file);
  if (!source) {
    source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    sourceFiles.set(file, source);
  }
  return source;
};

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "__fixtures__" ? [] : walk(path);
    return /\.ts$/.test(entry.name) && !/\.(test|stub)\.ts$/.test(entry.name)
      ? [path]
      : [];
  });

const packageRoot = (file: string) => file.slice(0, file.indexOf("/src/"));

/** Resolves `./x`, `../x` and the `@internal/x`, `@api/x`, `@root/x` aliases every package uses. */
const resolveModule = (spec: string, fromFile: string): string | null => {
  const root = packageRoot(fromFile);
  const base = spec.startsWith(".")
    ? resolve(dirname(fromFile), spec)
    : spec.startsWith("@root/")
      ? join(root, spec.slice("@root/".length))
      : /^@(internal|api)\//.test(spec)
        ? join(root, "src", spec.slice(1))
        : null;
  if (!base) return null;
  return (
    [`${base}.ts`, join(base, "index.ts")].find((candidate) =>
      existsSync(candidate),
    ) ?? null
  );
};

/** Finds what a name refers to in a file: a local declaration, or one it imports or re-exports. */
const findDeclaration = (
  name: string,
  file: string,
  seen = new Set<string>(),
): { node: ts.Node; file: string } | null => {
  if (seen.has(`${file}#${name}`)) return null;
  seen.add(`${file}#${name}`);
  const source = sourceFile(file);
  let found: ts.Node | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      (ts.isVariableDeclaration(node) || ts.isEnumDeclaration(node)) &&
      node.name.getText(source) === name
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (found) return { node: found, file };

  for (const statement of source.statements) {
    const fromImport =
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
        ? statement.importClause.namedBindings.elements
        : ts.isExportDeclaration(statement) &&
            statement.exportClause &&
            ts.isNamedExports(statement.exportClause)
          ? statement.exportClause.elements
          : null;
    const specifier =
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : null;
    if (!specifier) continue;
    const target = resolveModule(specifier, file);
    if (!target) continue;
    if (fromImport) {
      const element = fromImport.find((e) => e.name.text === name);
      if (element) {
        return findDeclaration(
          element.propertyName?.text ?? name,
          target,
          seen,
        );
      }
    } else if (ts.isExportDeclaration(statement)) {
      const result = findDeclaration(name, target, seen);
      if (result) return result;
    }
  }
  return null;
};

/** Every value an expression can take: constants are followed, both branches of a condition are kept. */
const evaluate = (expression: ts.Expression, file: string): number[] => {
  if (ts.isNumericLiteral(expression)) return [Number(expression.text)];
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return evaluate(expression.expression, file);
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...evaluate(expression.whenTrue, file),
      ...evaluate(expression.whenFalse, file),
    ];
  }
  if (ts.isIdentifier(expression)) {
    const declaration = findDeclaration(expression.text, file);
    if (!declaration) return [];
    const { node } = declaration;
    const initializer =
      ts.isVariableDeclaration(node) || ts.isEnumMember(node)
        ? node.initializer
        : undefined;
    return initializer ? evaluate(initializer, declaration.file) : [];
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = expression.expression;
    if (!ts.isIdentifier(owner)) return [];
    const declaration = findDeclaration(owner.text, file);
    if (!declaration) return [];
    const { node } = declaration;
    const member = expression.name.text;
    if (ts.isEnumDeclaration(node)) {
      const enumMember = node.members.find(
        (m) => m.name.getText(node.getSourceFile()) === member,
      );
      return enumMember?.initializer
        ? evaluate(enumMember.initializer, declaration.file)
        : [];
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      let object: ts.Expression = node.initializer;
      while (ts.isAsExpression(object) || ts.isSatisfiesExpression(object)) {
        object = object.expression;
      }
      if (!ts.isObjectLiteralExpression(object)) return [];
      const property = object.properties.find(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) &&
          p.name.getText(object.getSourceFile()) === member,
      );
      return property ? evaluate(property.initializer, declaration.file) : [];
    }
  }
  return [];
};

/** The CLA/INS pairs a command class sends, read from the object literals it passes to ApduBuilder. */
const readCommand = (file: string) => {
  const source = sourceFile(file);
  let name: string | null = null;
  const pairs: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyDeclaration(node) &&
      node.name.getText(source) === "name" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      name = node.initializer.text;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const value = (key: string) => {
        const property = node.properties.find(
          (p) => p.name?.getText(source) === key,
        );
        if (property && ts.isPropertyAssignment(property)) {
          return evaluate(property.initializer, file);
        }
        if (property && ts.isShorthandPropertyAssignment(property)) {
          return evaluate(property.name, file);
        }
        return null;
      };
      const clas = value("cla");
      const inss = value("ins");
      if (clas && inss) {
        for (const cla of clas) {
          for (const ins of inss) pairs.push(hex(cla) + hex(ins));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return name ? { name, pairs: [...new Set(pairs)] } : null;
};

const hex = (byte: number) => byte.toString(16).padStart(2, "0");

/** App names a package declares: its `APP_NAME` constants, and the `appName` of each of its profiles. */
const appNames = (packageDir: string): string[] => {
  const names = new Set<string>();
  for (const file of walk(join(packageDir, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\bAPP_NAME\s*=\s*"([^"]+)"/g)) {
      names.add(match[1]!);
    }
    if (file.includes("/api/profiles/")) {
      for (const match of text.matchAll(/\bappName:\s*"([^"]+)"/g)) {
        names.add(match[1]!);
      }
    }
  }
  return [...names];
};

const commandSources = (): CommandSource[] => {
  const appPackages = ["signer", "trusted-apps"].flatMap((group) =>
    readdirSync(join(PACKAGES_DIR, group)).map((name) => join(group, name)),
  );
  return [
    { dir: "device-management-kit/src/api/command", apps: null },
    { dir: "ledger-wallet/src/api/command", apps: null },
    // Contacts are an OS feature: CLA b0 inside the apps, CLA e0 (rename) on the dashboard
    { dir: "device-contacts-kit/src", apps: null },
    ...appPackages
      .filter((dir) => existsSync(join(PACKAGES_DIR, dir, "src")))
      .map((dir) => ({
        dir: `${dir}/src`,
        apps: appNames(join(PACKAGES_DIR, dir)),
      })),
  ];
};

type Table = Record<string, Set<string>>;

const add = (table: Table, key: string, name: string) =>
  (table[key] ??= new Set()).add(name);

export const generateApduCommands = async (): Promise<string> => {
  const common: Table = {};
  const dashboard: Table = {};
  const apps: Record<string, Table> = {};

  for (const { dir, apps: appList } of commandSources()) {
    const files = walk(join(PACKAGES_DIR, dir)).filter((file) =>
      file.endsWith("Command.ts"),
    );
    for (const file of files) {
      const command = readCommand(file);
      if (!command) continue;
      for (const pair of command.pairs) {
        if (pair.startsWith(hex(COMMON_CLA))) add(common, pair, command.name);
        else if (appList === null) add(dashboard, pair, command.name);
        else
          for (const app of appList)
            add((apps[app] ??= {}), pair, command.name);
      }
    }
  }

  const render = (table: Table, indent: string) =>
    Object.keys(table)
      .sort()
      .map(
        (key) =>
          `${indent}${JSON.stringify(key)}: ${JSON.stringify([...table[key]!].sort().join(" / "))},`,
      )
      .join("\n");

  const code = `// Generated by \`pnpm generate:apdu-commands\` from the command classes of DMK, the signers and the trusted apps. Do not edit.

/** CLA b0: answered the same way by the dashboard and by every app. */
export const COMMON_COMMANDS: Record<string, string> = {
${render(common, "  ")}
};

/** Answered by the dashboard only; inside an app the same bytes go to the app. */
export const DASHBOARD_COMMANDS: Record<string, string> = {
${render(dashboard, "  ")}
};

/** Each app's own commands, by the app name the device reports. */
export const APP_COMMANDS: Record<string, Record<string, string>> = {
${Object.keys(apps)
  .sort()
  .map(
    (app) => `  ${JSON.stringify(app)}: {\n${render(apps[app]!, "    ")}\n  },`,
  )
  .join("\n")}
};
`;
  return format(code, {
    ...(await resolveConfig(OUT_FILE)),
    filepath: OUT_FILE,
  });
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void generateApduCommands().then((code) => {
    writeFileSync(OUT_FILE, code, "utf8");
    console.log(
      `APDU commands written to ${relative(process.cwd(), OUT_FILE)}`,
    );
  });
}
