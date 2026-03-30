const KNOWN_COMMANDS: Record<string, string> = {
  B001: "GET_APP_AND_VERSION",
  E004: "GET_ADDRESS (ETH)",
  E006: "SIGN_TRANSACTION (ETH)",
  E00A: "SIGN_PERSONAL_MESSAGE (ETH)",
  E00C: "SIGN_TYPED_DATA (ETH)",
  E012: "PROVIDE_ERC20_TOKEN_INFO",
  E014: "PROVIDE_NFT_INFO",
  E016: "SET_EXTERNAL_PLUGIN",
  E018: "SET_PLUGIN",
  E01A: "PROVIDE_DOMAIN_NAME",
  E01E: "PROVIDE_TRUSTED_NAME",
  E0D8: "OPEN_APP",
  E0D4: "CLOSE_APP",
  E0DE: "LIST_APPS",
  B0A7: "GET_BATTERY_STATUS",
  E050: "GET_PUBLIC_KEY (BTC)",
  E048: "SIGN_TRANSACTION (BTC)",
  E002: "GET_PUBLIC_KEY (SOL)",
  E006_SOL: "SIGN_TRANSACTION (SOL)",
};

const STATUS_WORDS: Record<string, { label: string; severity: "ok" | "warn" | "error" }> = {
  "9000": { label: "Success", severity: "ok" },
  "6700": { label: "Wrong length", severity: "error" },
  "6982": { label: "Security status not satisfied (device locked?)", severity: "error" },
  "6985": { label: "Conditions not satisfied (user rejected?)", severity: "warn" },
  "6A80": { label: "Incorrect data", severity: "error" },
  "6A82": { label: "App not found", severity: "error" },
  "6A84": { label: "Not enough memory", severity: "error" },
  "6B00": { label: "Incorrect P1/P2", severity: "error" },
  "6D00": { label: "INS not supported", severity: "error" },
  "6E00": { label: "CLA not supported", severity: "error" },
  "6FAA": { label: "Device locked", severity: "error" },
  "6F00": { label: "Internal error", severity: "error" },
};

export interface DecodedApdu {
  raw: string;
  cla: string;
  ins: string;
  p1: string;
  p2: string;
  commandName: string;
  dataLength: number;
  data: string;
}

export interface DecodedStatusWord {
  raw: string;
  label: string;
  severity: "ok" | "warn" | "error";
}

export function decodeCommandApdu(hex: string): DecodedApdu {
  const upper = hex.toUpperCase();
  const cla = upper.slice(0, 2);
  const ins = upper.slice(2, 4);
  const p1 = upper.slice(4, 6);
  const p2 = upper.slice(6, 8);
  const key = cla + ins;
  const commandName = KNOWN_COMMANDS[key] ?? `UNKNOWN (${key})`;
  const lc = upper.length > 8 ? parseInt(upper.slice(8, 10), 16) : 0;
  const data = upper.length > 10 ? upper.slice(10) : "";

  return { raw: upper, cla, ins, p1, p2, commandName, dataLength: lc, data };
}

export function decodeStatusWord(hex: string): DecodedStatusWord {
  const sw = hex.toUpperCase().slice(-4);
  const known = STATUS_WORDS[sw];
  return known
    ? { raw: sw, ...known }
    : { raw: sw, label: `Unknown status (${sw})`, severity: "warn" };
}

export function tryDecodeAscii(hex: string): string | null {
  try {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (byte >= 32 && byte <= 126) bytes.push(byte);
      else return null;
    }
    return String.fromCharCode(...bytes);
  } catch {
    return null;
  }
}
