import { type AiRequest } from "./types";

const REDACTED = "<redacted>";
// Any key naming a credential, in camelCase or snake_case: accessToken, refresh_token,
// clientSecret, privateKey, seedPhrase, mnemonic, password, apiKey, Authorization…
const KEY = String.raw`\b([A-Za-z0-9_-]*(?:token|secret|password|passphrase|api[_-]?key|private[_-]?key|seed|mnemonic)[A-Za-z0-9_-]*|authorization)`;

// A credential key, its separator and the quote opening its value, plain or
// escaped as in a log of JSON: `"token": "`, `token='`, `\"token\":\"`
const QUOTED_VALUE = new RegExp(
  String.raw`${KEY}(\\?["']?\s*[:=]\s*)(\\?["'])`,
  "gi",
);

// Where the quoted value that starts at `from` ends, skipping escaped characters
const closingQuote = (text: string, from: number, quote: string) => {
  for (let i = from; i < text.length; i++) {
    if (text.startsWith(quote, i)) return i;
    if (text[i] === "\\") i++;
  }
  return -1;
};

// The whole quoted value, whatever spaces, commas or escaped quotes it holds
const redactQuotedValues = (text: string) => {
  let redacted = "";
  let copied = 0;
  for (const match of text.matchAll(QUOTED_VALUE)) {
    const start = match.index + match[0].length;
    if (match.index < copied) continue;
    const end = closingQuote(text, start, match[3]!);
    if (end < 0) continue;
    redacted += text.slice(copied, start) + REDACTED;
    copied = end;
  }
  return redacted + text.slice(copied);
};

// Session tokens the app shared, and anything that looks like a credential
export const redact = (text: string, secrets: string[]) =>
  redactQuotedValues(
    secrets.reduce(
      (redacted, secret) => redacted.replaceAll(secret, REDACTED),
      text,
    ),
  )
    // An unquoted Authorization header, whatever its scheme: up to the end of the line
    .replace(
      /\b(authorization\s*:\s*)(?!<redacted>)[^\r\n"']+/gi,
      `$1${REDACTED}`,
    )
    .replace(/\b(bearer\s+)(?!<redacted>)[^\s"',;\\]+/gi, `$1${REDACTED}`)
    .replace(
      /\b(basic\s+)(?!<redacted>)[A-Za-z0-9+/]{8,}={0,2}/gi,
      `$1${REDACTED}`,
    )
    .replace(
      new RegExp(
        String.raw`${KEY}(["']?\s*[:=]\s*)(?!<redacted>|\\?["'])[^\s"',;&\\]+`,
        "gi",
      ),
      `$1$2${REDACTED}`,
    );

export const redactRequest = (
  request: AiRequest,
  secrets: string[],
): AiRequest => {
  switch (request.kind) {
    case "explain":
      return { ...request, context: redact(request.context, secrets) };
    case "followUp":
      return { ...request, question: redact(request.question, secrets) };
    case "createTicket":
      return request;
  }
};
