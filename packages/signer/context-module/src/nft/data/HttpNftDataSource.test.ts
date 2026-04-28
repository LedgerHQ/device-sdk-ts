import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

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
} as ContextModuleServiceConfig;

describe("HttpNftDataSource", () => {
  let datasource: NftDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = { get: vi.fn() };
    datasource = new HttpNftDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("getNftInfosPayload", () => {
    it("should call the expected metadata service URL", async () => {
      httpMock.get.mockResolvedValue({ payload: "payload" });

      await datasource.getNftInfosPayload({ address: "0x00", chainId: 1 });

      expect(httpMock.get).toHaveBeenCalledWith(
        "https://nft.api.live.ledger.com/v1/ethereum/1/contracts/0x00",
      );
    });

    it("should return an error when the network client throws", async () => {
      httpMock.get.mockRejectedValue(new Error("error"));

      const result = await datasource.getNftInfosPayload({
        address: "0x00",
        chainId: 1,
      });

      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpNftDataSource: Failed to fetch nft informations",
        ),
      );
    });

    it("should return an error when the response has no payload", async () => {
      httpMock.get.mockResolvedValue({});

      const result = await datasource.getNftInfosPayload({
        address: "0x00",
        chainId: 1,
      });

      expect(result.extract()).toEqual(
        new Error("[ContextModule] HttpNftDataSource: no nft metadata"),
      );
    });

    it("should return the payload", async () => {
      httpMock.get.mockResolvedValue({ payload: "payload" });

      const result = await datasource.getNftInfosPayload({
        address: "0x00",
        chainId: 1,
      });

      expect(result.extract()).toEqual("payload");
    });
  });

  describe("getSetPluginPayload", () => {
    it("should call the expected metadata service URL", async () => {
      httpMock.get.mockResolvedValue({ payload: "payload" });

      await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      expect(httpMock.get).toHaveBeenCalledWith(
        "https://nft.api.live.ledger.com/v1/ethereum/1/contracts/0x00/plugin-selector/0x00",
      );
    });

    it("should return an error when the network client throws", async () => {
      httpMock.get.mockRejectedValue(new Error("error"));

      const result = await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpNftDataSource: Failed to fetch set plugin payload",
        ),
      );
    });

    it("should return an error when the response has no payload", async () => {
      httpMock.get.mockResolvedValue({});

      const result = await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpNftDataSource: unexpected empty response",
        ),
      );
    });

    it("should return the payload", async () => {
      httpMock.get.mockResolvedValue({ payload: "payload" });

      const result = await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      expect(result.extract()).toEqual("payload");
    });
  });
});
