import { Permissions } from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";

type PERMISSION_VALUE =
  | "OWNER"
  | "CAN_ENCRYPT"
  | "CAN_DERIVE"
  | "CAN_ADD_BLOCK";
type UNARY_OP = { type: "UnaryOP"; value: "~" };
type BINARY_OP = {
  type: "BinaryOp";
  value: "&" | "|" | "^" | "<<" | ">>" | ">>>" | "+" | "-";
};

type NODE = { start: number; end: number } & (PERMISSION | OP);
type PERMISSION = { type: "Permission"; value: PERMISSION_VALUE };
type OP =
  | (UNARY_OP & { children: [NODE] })
  | (BINARY_OP & { children: [NODE, NODE] });

type TOKEN = { start: number; end: number } & (
  | PERMISSION
  | UNARY_OP
  | BINARY_OP
  | { type: "(" }
  | { type: ")" }
  | { type: "EOS" }
);

// WARNING: This is untested and overkilled for the use case.
// Also it doesn't handle binary operator priority
// (the first operation is done last unless brackets are used).
export function parsePermissions(str: string) {
  const ast = parseExpression(0, 0);
  return calculate(ast);

  function parseToken(pos: number): TOKEN {
    const start = pos + (str.slice(pos).match(/^\s*/)?.[0].length ?? 0);
    const rest = str.slice(start);

    if (rest.length === 0) {
      return { type: "EOS", start, end: start };
    }

    const permissionMatch = rest.match(
      /^(OWNER|CAN_ENCRYPT|CAN_DERIVE|CAN_ADD_BLOCK)\b/,
    );
    if (permissionMatch) {
      const value = permissionMatch[1] as PERMISSION_VALUE;
      const end = start + value.length;
      return { type: "Permission", value, start, end };
    }

    const unaryOpMatch = rest.match(/^~/);
    if (unaryOpMatch) {
      return { type: "UnaryOP", value: "~", start, end: start + 1 };
    }

    const binaryOpMatch = rest.match(/^(?:&|\||\^|<<|>>>|>>|\+|-)/);
    if (binaryOpMatch) {
      const value = binaryOpMatch[0] as BINARY_OP["value"];
      return { type: "BinaryOp", value, start, end: start + value.length };
    }

    if (rest.startsWith("(")) {
      return { type: "(", start, end: start + 1 };
    }

    if (rest.startsWith(")")) {
      return { type: ")", start, end: start + 1 };
    }

    throw error({ type: "unknown", start, end: start + 1 });
  }

  function parseValue(pos: number, depth: number): NODE {
    const token = parseToken(pos);
    switch (token.type) {
      case "Permission":
        return token;
      case "UnaryOP": {
        const value = parseValue(token.end, depth);
        return { ...token, end: value.end, children: [value] };
      }
      case "(": {
        const expr = parseExpression(token.end, depth + 1);
        return { ...expr, start: token.start };
      }

      default:
        throw error(token);
    }
  }
  function parseExpression(pos: number, depth: number): NODE {
    const left = parseValue(pos, depth);
    return parseNext(left, depth);
  }

  function parseNext(left: NODE, depth: number): NODE {
    const pos = left.end;
    const token = parseToken(pos);
    switch (token.type) {
      case "EOS":
        return left;
      case ")":
        if (depth === 0) throw error(token);
        return { ...left, end: token.end };
      case "BinaryOp": {
        const right = parseValue(token.end, depth);
        const node: NODE = {
          ...token,
          children: [left, right],
          start: left.start,
          end: right.end,
        };
        return parseNext(node, depth);
      }
      default:
        throw error(token);
    }
  }

  function calculate(node: NODE): number {
    switch (node.type) {
      case "Permission":
        return {
          OWNER: Permissions.OWNER,
          CAN_ENCRYPT: Permissions.CAN_ENCRYPT,
          CAN_DERIVE: Permissions.CAN_DERIVE,
          CAN_ADD_BLOCK: Permissions.CAN_ADD_BLOCK,
        }[node.value];

      case "UnaryOP":
        switch (node.value) {
          case "~":
            return ~calculate(node.children[0]);
        }
        break; // Just to satisfy ESLint

      case "BinaryOp": {
        const left = calculate(node.children[0]);
        const right = calculate(node.children[1]);
        switch (node.value) {
          case "&":
            return left & right;
          case "|":
            return left | right;
          case "^":
            return left ^ right;
          case "<<":
            return left << right;
          case ">>":
            return left >> right;
          case ">>>":
            return left >>> right;
          case "+":
            return left + right;
          case "-":
            return left - right;
        }
      }
    }
  }

  function error(
    token: TOKEN | { type: "unknown"; start: number; end: number },
  ): Error {
    return new Error(
      [errorMessage(), str, "^".padStart(token.start + 1)].join("\n"),
    );

    function errorMessage() {
      switch (token.type) {
        case "EOS":
          return `Unexpected end of string at position ${token.start}`;
        default:
          return `Unexpected token: ${str.slice(token.start, token.end)} at position ${token.start}`;
      }
    }
  }
}
