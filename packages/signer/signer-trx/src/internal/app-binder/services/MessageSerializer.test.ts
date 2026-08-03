import { encodeDerivationPath } from "@internal/app-binder/command/utils/encodeDerivationPath";

import { serializePersonalMessage } from "./MessageSerializer";

const PATH = "44'/195'/0'/0/0";
const PATH_HEX = "058000002c800000c3800000000000000000000000";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const ascii = (s: string): Uint8Array =>
  Uint8Array.from(s, (c) => c.charCodeAt(0));

describe("serializePersonalMessage", () => {
  it("frames a short message into a single frame (golden vector from hw-app-trx)", () => {
    // Vector: `=> e008000045` + path + 4-byte length prefix + message.
    const message = ascii("CryptoChain-TronSR Ledger Transactions Tests");
    const messageHex = toHex(message);
    const lengthPrefix = "0000002c"; // 44 bytes, big-endian

    const frames = serializePersonalMessage(
      encodeDerivationPath(PATH),
      message,
    );

    expect(frames).toHaveLength(1);
    expect(frames[0]!.p1).toBe(0x00);
    expect(toHex(frames[0]!.payload)).toBe(
      PATH_HEX + lengthPrefix + messageHex,
    );
  });

  it("splits a long message into fixed-size frames with the path on the first", () => {
    const message = new Uint8Array(600).fill(0x61); // 600 * 'a'
    const frames = serializePersonalMessage(
      encodeDerivationPath(PATH),
      message,
    );

    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0]!.p1).toBe(0x00);
    frames.slice(1).forEach((f) => expect(f.p1).toBe(0x80));
    frames.forEach((f) => expect(f.payload.length).toBeLessThanOrEqual(250));

    // Reassembled frames equal path + 4-byte length prefix + message.
    const reassembled = frames.map((f) => toHex(f.payload)).join("");
    const expectedPrefix = (0x258).toString(16).padStart(8, "0"); // 600
    expect(reassembled).toBe(PATH_HEX + expectedPrefix + toHex(message));
  });
});
