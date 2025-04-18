import axios from "axios";

import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpNftDataSource } from "./HttpNftDataSource";
import { type NftDataSource } from "./NftDataSource";

vi.mock("axios");

describe("HttpNftDataSource", () => {
  let datasource: NftDataSource;

  beforeAll(() => {
    datasource = new HttpNftDataSource();
    vi.clearAllMocks();
  });

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
    vi.spyOn(axios, "request").mockImplementation(requestSpy);

    // WHEN
    await datasource.getNftInfosPayload({ address: "0x00", chainId: 1 });
    await datasource.getSetPluginPayload({
      address: "0x00",
      chainId: 1,
      selector: "0x00",
    });

    // THEN
    expect(requestSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        headers: { [LEDGER_CLIENT_VERSION_HEADER]: version },
      }),
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        headers: { [LEDGER_CLIENT_VERSION_HEADER]: version },
      }),
    );
  });

  describe("getNftInfosPayload", () => {
    it("should return an error when axios throws an error", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValue(new Error("error"));

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
      const response = { data: {} };
      vi.spyOn(axios, "request").mockResolvedValue(response);

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
      const response = { data: { payload: "payload" } };
      vi.spyOn(axios, "request").mockResolvedValue(response);

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
    it("should return an error when axios throws an error", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValue(new Error("error"));

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
      const response = { data: {} };
      vi.spyOn(axios, "request").mockResolvedValue(response);

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
      const response = { data: { payload: "payload" } };
      vi.spyOn(axios, "request").mockResolvedValue(response);

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
