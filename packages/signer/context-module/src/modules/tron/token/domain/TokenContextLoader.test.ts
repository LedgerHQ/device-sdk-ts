import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type TokenDataSource } from "@/modules/tron/token/data/TokenDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { TokenContextLoader } from "./TokenContextLoader";

const fromHex = (hex: string) =>
  Uint8Array.from(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

// TransferAssetContract, asset_name "1002000".
const TRC10_TRANSFER = fromHex(
  "0a023dce220895da42177db005074080d095ffbc315a75080212710a32747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e736665724173736574436f6e7472616374123b0a0731303032303030121541c8599111f29c1e1e061265b4af93ea1f274ad78a1a154114183f3bbca4ae9fc1de55b9bbe2d071942dc1a62087ad4b70a0fb91ffbc31",
);

// Plain TRX TransferContract.
const TRX_TRANSFER = fromHex(
  "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d",
);

const PAYLOAD =
  "0a0a426974546f7272656e7410061a46304402202e2502f36b00e57be785fc79ec4043abcdd4fdd1b58d737ce123599dffad2cb602201702c307f009d014a553503b499591558b3634ceee4c054c61cedd8aca94c02b";

describe("TokenContextLoader", () => {
  let dataSource: TokenDataSource;
  let loader: TokenContextLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    dataSource = {
      getTokenInfosPayload: vi.fn(),
    } as unknown as TokenDataSource;
    loader = new TokenContextLoader(dataSource);
  });

  describe("canHandle", () => {
    it("should handle a raw transaction when the token type is expected", () => {
      expect(
        loader.canHandle({ rawTransaction: TRC10_TRANSFER }, [
          ClearSignContextType.TRON_TOKEN,
        ]),
      ).toBe(true);
    });

    it("should not handle it when the token type is not expected", () => {
      expect(
        loader.canHandle({ rawTransaction: TRC10_TRANSFER }, [
          ClearSignContextType.ETHEREUM_TOKEN,
        ]),
      ).toBe(false);
    });

    it.each([
      ["null", null],
      ["an empty object", {}],
      ["a hex string", { rawTransaction: "0a023dce" }],
      ["an empty transaction", { rawTransaction: new Uint8Array() }],
    ])("should not handle %s", (_label, input) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRON_TOKEN])).toBe(
        false,
      );
    });
  });

  describe("load", () => {
    it("should return the token context of a TRC10 transfer", async () => {
      vi.spyOn(dataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(PAYLOAD),
      );

      const result = await loader.load({ rawTransaction: TRC10_TRANSFER });

      expect(dataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        assetId: "1002000",
      });
      expect(result).toEqual([
        { type: ClearSignContextType.TRON_TOKEN, payload: PAYLOAD },
      ]);
    });

    it("should return no context and not call CAL when the transaction holds no TRC10 transfer", async () => {
      const result = await loader.load({ rawTransaction: TRX_TRANSFER });

      expect(result).toEqual([]);
      expect(dataSource.getTokenInfosPayload).not.toHaveBeenCalled();
    });

    it("should return an error context when the token is unknown to CAL", async () => {
      const error = new Error("not found");
      vi.spyOn(dataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(error),
      );

      const result = await loader.load({ rawTransaction: TRC10_TRANSFER });

      expect(result).toEqual([{ type: ClearSignContextType.ERROR, error }]);
    });
  });
});
