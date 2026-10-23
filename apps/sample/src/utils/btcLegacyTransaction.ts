import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type LegacyCreateTransactionArg,
  type LegacyTransaction,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";

export type SignTransactionInput = {
  inputs: string;
  associatedKeysets: string;
  changePath: string;
  outputScriptHex: string;
  lockTime: string;
  skipOpenApp: boolean;
};

// Splits a raw transaction without SegWit data into the fields the signer
// takes, as hw-app-btc's splitTransaction does.
const splitTransaction = (hex: string): LegacyTransaction => {
  const bytes = hexaStringToBuffer(hex);
  if (bytes === null) {
    throw new Error("The previous transaction is not hexadecimal");
  }
  let offset = 0;
  const take = (length: number) => {
    if (offset + length > bytes.length) {
      throw new Error("The previous transaction is truncated");
    }
    offset += length;
    return bytes.slice(offset - length, offset);
  };
  const takeVarint = () => {
    const first = take(1)[0]!;
    if (first < 0xfd) return first;
    const size = first === 0xfd ? 2 : first === 0xfe ? 4 : 8;
    return take(size).reduceRight((value, byte) => value * 256 + byte, 0);
  };

  const version = take(4);
  const inputs = Array.from({ length: takeVarint() }, () => {
    const prevout = take(36);
    const script = take(takeVarint());
    return { prevout, script, sequence: take(4) };
  });
  const outputs = Array.from({ length: takeVarint() }, () => {
    const amount = take(8);
    return { amount, script: take(takeVarint()) };
  });
  const locktime = take(4);
  if (offset !== bytes.length) {
    throw new Error("The previous transaction has trailing data");
  }
  return { version, inputs, outputs, locktime };
};

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

// Each input is "<previous transaction hex>:<output index>[:<sequence>]".
export const buildTransaction = ({
  inputs,
  associatedKeysets,
  changePath,
  outputScriptHex,
  lockTime,
}: SignTransactionInput): LegacyCreateTransactionArg => ({
  inputs: splitList(inputs).map((input) => {
    const [previousTransaction = "", outputIndex = "", sequence] =
      input.split(":");
    return [
      splitTransaction(previousTransaction),
      Number(outputIndex),
      null,
      sequence === undefined ? null : Number(sequence),
    ];
  }),
  associatedKeysets: splitList(associatedKeysets),
  changePath: changePath.trim() || undefined,
  outputScriptHex: outputScriptHex.trim(),
  lockTime: Number(lockTime || 0),
});
