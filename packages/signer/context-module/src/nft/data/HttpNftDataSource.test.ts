import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpNftDataSource } from "./HttpNftDataSource";
import { type NftDataSource } from "./NftDataSource";

const config = {
  web3checks: {
    url: "web3checksUrl",
  },
  metadataServiceDomain: {
    url: "https://nft.api.live.ledger.com",
  },
  originToken: "originToken",
} as ContextModuleConfig;
describe("HttpNftDataSource", () => {
  let datasource: NftDataSource;

  beforeAll(() => {
    datasource = new HttpNftDataSource(config);
    vi.clearAllMocks();
  });

  it("should call fetch with the ledger client version and origin Token header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([])),
    );

    // WHEN
    await datasource.getNftInfosPayload({ address: "0x00", chainId: 1 });
    await datasource.getSetPluginPayload({
      address: "0x00",
      chainId: 1,
      selector: "0x00",
    });

    // THEN
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: version,
          [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
        },
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: version,
          [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
        },
      }),
    );
  });

  describe("getNftInfosPayload", () => {
    it("should return an error when fetch throws an error", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("error"));

      // WHEN
      const result = await datasource.getNftInfosPayload({
        address: "0x00",
        chainId: 1,
      });

      // THEN
      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpNftDataSource: Failed to fetch nft informations",
        ),
      );
    });

    it("should return an error when the response is empty", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({})),
      );

      // WHEN
      const result = await datasource.getNftInfosPayload({
        address: "0x00",
        chainId: 1,
      });

      // THEN
      expect(result.extract()).toEqual(
        new Error("[ContextModule] HttpNftDataSource: no nft metadata"),
      );
    });

    it("should return the payload", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ payload: "payload" })),
      );

      // WHEN
      const result = await datasource.getNftInfosPayload({
        address: "0x00",
        chainId: 1,
      });

      // THEN
      expect(result.extract()).toEqual("payload");
    });
  });

  describe("getSetPluginPayload", () => {
    it("should return an error when fetch throws an error", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("error"));

      // WHEN
      const result = await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      // THEN
      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpNftDataSource: Failed to fetch set plugin payload",
        ),
      );
    });

    it("should return an error when the response is empty", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({})),
      );

      // WHEN
      const result = await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      // THEN
      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpNftDataSource: unexpected empty response",
        ),
      );
    });

    it("should return the payload", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ payload: "payload" })),
      );

      // WHEN
      const result = await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      // THEN
      expect(result.extract()).toEqual("payload");
    });
  });
});
