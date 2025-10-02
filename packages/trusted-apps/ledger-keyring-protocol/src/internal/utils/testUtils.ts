export function noWS(str: TemplateStringsArray) {
  return str.join("").replace(/\s+/g, "");
}

export function unIndent(str: TemplateStringsArray) {
  const lines = str.join("").split("\n").slice(1, -1);
  const baseIndent = lines[0]?.match(/^\s*/)?.[0]?.length ?? 0;
  return lines.map((line) => line.slice(baseIndent)).join("\n");
}
