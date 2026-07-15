import { encodeDerivationPath } from "@internal/app-binder/command/utils/encodeDerivationPath";

import { serializeTransaction } from "./TransactionSerializer";

const PATH = "44'/195'/0'/0/0";
// Encoded "44'/195'/0'/0/0": length byte (05) + 5 BE32 path elements.
const PATH_HEX = "058000002c800000c3800000000000000000000000";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

describe("serializeTransaction", () => {
  it("frames a small transaction into a single frame (golden vector from hw-app-trx)", () => {
    // Vector: `=> e0041000c9` + path + rawTx, from hw-app-trx Trx.test.ts.
    const rawTxHex =
      "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d";

    const frames = serializeTransaction(
      encodeDerivationPath(PATH),
      fromHex(rawTxHex),
    );

    expect(frames).toHaveLength(1);
    expect(frames[0]!.p1).toBe(0x10);
    expect(toHex(frames[0]!.payload)).toBe(PATH_HEX + rawTxHex);
  });

  it("splits a large transaction on protobuf field boundaries without splitting a field", () => {
    // 200 two-byte varint fields (0x08 0x01); too big for one 250-byte frame.
    const rawTxHex = "0801".repeat(200);
    const frames = serializeTransaction(
      encodeDerivationPath(PATH),
      fromHex(rawTxHex),
    );

    expect(frames.map((f) => f.p1)).toEqual([0x00, 0x90]);
    // First frame holds the path header; no frame exceeds the chunk size.
    frames.forEach((f) => expect(f.payload.length).toBeLessThanOrEqual(250));
    // Reassembled payload (minus the path header on frame 0) equals the rawTx.
    const body = toHex(frames[0]!.payload).slice(PATH_HEX.length);
    expect(body + toHex(frames[1]!.payload)).toBe(rawTxHex);
    // Every continuation frame starts on a whole field (even byte length).
    expect(frames[1]!.payload.length % 2).toBe(0);
  });

  it("marks intermediate frames as subsequent on transactions spanning many frames", () => {
    // 400 two-byte varint fields (0x08 0x01) -> 800 bytes, needing 4 frames.
    const rawTxHex = "0801".repeat(400);
    const frames = serializeTransaction(
      encodeDerivationPath(PATH),
      fromHex(rawTxHex),
    );

    expect(frames.map((f) => f.p1)).toEqual([0x00, 0x80, 0x80, 0x90]);
    frames.forEach((f) => expect(f.payload.length).toBeLessThanOrEqual(250));
    // Reassembled payload (minus the path header on frame 0) equals the rawTx.
    const reassembled = frames
      .map((f) => toHex(f.payload))
      .join("")
      .slice(PATH_HEX.length);
    expect(reassembled).toBe(rawTxHex);
  });

  it("throws when a single protobuf field exceeds the chunk size", () => {
    // Field key 0x0a (length-delimited), declared length 251, 251 payload bytes.
    const oversized = "0a" + "fb01" + "00".repeat(251);
    expect(() =>
      serializeTransaction(encodeDerivationPath(PATH), fromHex(oversized)),
    ).toThrow("Too many bytes to encode.");
  });
});
