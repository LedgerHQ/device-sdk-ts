import { describe, expect, it } from "vitest";

import { parseTrc10AssetId } from "./parseTrc10AssetId";

const fromHex = (hex: string) =>
  Uint8Array.from(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

// TransferAssetContract, asset_name "1002000" (BitTorrent), amount 1234567.
const TRC10_TRANSFER =
  "0a023dce220895da42177db005074080d095ffbc315a75080212710a32747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e736665724173736574436f6e7472616374123b0a0731303032303030121541c8599111f29c1e1e061265b4af93ea1f274ad78a1a154114183f3bbca4ae9fc1de55b9bbe2d071942dc1a62087ad4b70a0fb91ffbc31";

// TriggerSmartContract calling transfer(address,uint256) on USDT.
const TRC20_TRANSFER =
  "0a023dce220895da42177db005074080d095ffbc315aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541a614f803b6fd780986a42c78ec9c7f77e6ded13c2244a9059cbb00000000000000000000000014183f3bbca4ae9fc1de55b9bbe2d071942dc1a60000000000000000000000000000000000000000000000000000000000bc614e70a0fb91ffbc31900180c2d72f";

// Plain TRX TransferContract, from the hw-app-trx vector.
const TRX_TRANSFER =
  "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d";

// TransferAssetContract whose asset_name is "_", the native-TRX marker.
const NATIVE_TRX_ASSET =
  "0a023dce220895da42177db005074080d095ffbc315a6e0802126a0a32747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e736665724173736574436f6e747261637412340a015f121541c8599111f29c1e1e061265b4af93ea1f274ad78a1a154114183f3bbca4ae9fc1de55b9bbe2d071942dc1a620e80770a0fb91ffbc31";

describe("parseTrc10AssetId", () => {
  it("should return the asset id of a TRC10 transfer", () => {
    expect(parseTrc10AssetId(fromHex(TRC10_TRANSFER))).toBe("1002000");
  });

  it("should return undefined for a TRC20 transfer", () => {
    expect(parseTrc10AssetId(fromHex(TRC20_TRANSFER))).toBeUndefined();
  });

  it("should return undefined for a plain TRX transfer", () => {
    expect(parseTrc10AssetId(fromHex(TRX_TRANSFER))).toBeUndefined();
  });

  it("should return undefined when the asset name is the native TRX marker", () => {
    expect(parseTrc10AssetId(fromHex(NATIVE_TRX_ASSET))).toBeUndefined();
  });

  it("should return undefined for an empty transaction", () => {
    expect(parseTrc10AssetId(new Uint8Array())).toBeUndefined();
  });

  it("should return undefined for a truncated transaction", () => {
    const truncated = fromHex(TRC10_TRANSFER).subarray(0, 40);
    expect(parseTrc10AssetId(truncated)).toBeUndefined();
  });

  it("should return undefined for bytes that are not protobuf", () => {
    expect(parseTrc10AssetId(fromHex("ffffffffffffffffffff"))).toBeUndefined();
  });
});
