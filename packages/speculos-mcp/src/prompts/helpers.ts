export function signClause(args: {
  rawTx?: string;
  typedData?: string;
  derivationPath?: string;
}): string {
  const tool = args.rawTx ? "sign_transaction" : "sign_typed_data";
  const payload = args.rawTx
    ? `rawTx: "${args.rawTx}"`
    : `typedData: '${args.typedData}'`;
  const path = args.derivationPath
    ? ` with derivationPath "${args.derivationPath}"`
    : "";
  return `Call '${tool}' with ${payload}${path}`;
}
