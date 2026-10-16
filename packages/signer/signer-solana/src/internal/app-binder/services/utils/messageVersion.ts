import {
  InvalidSolanaTransactionError,
  SolanaTransactionVersionNotSupportedError,
} from "@api/model/SolanaTransactionErrors";

import { decodeV1Message } from "./v1Message";

const VERSIONED_MESSAGE_FLAG = 0x80;
const VERSION_MASK = 0x7f;

/**
 * A Solana message version: `"legacy"`, `0`, `1`, or a version no Solana app
 * supports yet.
 */
export type MessageVersion = "legacy" | 0 | 1 | { unsupported: number };

/**
 * Reads a message's version from its first byte. A legacy message starts with
 * its signer count, always below 0x80; a versioned one starts with
 * `0x80 | version`. Empty input reads as legacy and is left to the stages
 * that parse the message.
 */
export function getMessageVersion(messageBytes: Uint8Array): MessageVersion {
  const firstByte = messageBytes[0];
  if (firstByte === undefined || (firstByte & VERSIONED_MESSAGE_FLAG) === 0) {
    return "legacy";
  }
  const version = firstByte & VERSION_MASK;
  if (version === 0) return 0;
  if (version === 1) return 1;
  return { unsupported: version };
}

export type MessageVersionError =
  | SolanaTransactionVersionNotSupportedError
  | InvalidSolanaTransactionError;

/**
 * Whether the signer accepts a message's version. Returns the error that
 * refuses it, or `null` when it is accepted. It refuses a version no Solana
 * app supports, an invalid v1 message, and v1 on an app too old for it.
 * Validity is checked before the app version, so a broken transaction is
 * never reported as "update your app". Legacy and v0 are always accepted.
 */
export function checkMessageVersion(
  messageBytes: Uint8Array,
  isV1Supported: boolean,
): MessageVersionError | null {
  const version = getMessageVersion(messageBytes);
  if (typeof version === "object") {
    return new SolanaTransactionVersionNotSupportedError(
      version.unsupported,
      "unknownVersion",
    );
  }
  if (version !== 1) return null;
  return decodeV1Message(messageBytes).caseOf<MessageVersionError | null>({
    Left: ({ rule, detail }) => new InvalidSolanaTransactionError(rule, detail),
    Right: () =>
      isV1Supported
        ? null
        : new SolanaTransactionVersionNotSupportedError(1, "appVersion"),
  });
}
