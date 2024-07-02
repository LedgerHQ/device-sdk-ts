import axios from "axios";

import PACKAGE from "@root/package.json";

import { HttpNftDataSource } from "./HttpNftDataSource";
import { NftDataSource } from "./NftDataSource";

jest.mock("axios");

describe("HttpNftDataSource", () => {
  let datasource: NftDataSource;

  beforeAll(() => {
    datasource = new HttpNftDataSource();
    jest.clearAllMocks();
  });

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = jest.fn(() => Promise.resolve({ data: [] }));
    jest.spyOn(axios, "request").mockImplementation(requestSpy);

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
        headers: { "X-Ledger-Client-Version": version },
      }),
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        headers: { "X-Ledger-Client-Version": version },
      }),
    );
  });

  describe("getNftInfosPayload", () => {
    it("should return an error when axios throws an error", async () => {
      // GIVEN
      jest.spyOn(axios, "request").mockRejectedValue(new Error("error"));

      // WHEN
      const result = await datasource.getNftInfosPayload({
        address: "0x00",
        chainId: 1,
      });

      // THEN
      expect(result.extract()).toEqual(
        new Error("Failed to fetch nft informations"),
      );
    });

    it("should return the payload", async () => {
      // GIVEN
      const response = { data: { payload: "payload" } };
      jest.spyOn(axios, "request").mockResolvedValue(response);

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
      jest.spyOn(axios, "request").mockRejectedValue(new Error("error"));

      // WHEN
      const result = await datasource.getSetPluginPayload({
        address: "0x00",
        chainId: 1,
        selector: "0x00",
      });

      // THEN
      expect(result.extract()).toEqual(
        new Error("Failed to fetch set plugin payload"),
      );
    });

    it("should return the payload", async () => {
      // GIVEN
      const response = { data: { payload: "payload" } };
      jest.spyOn(axios, "request").mockResolvedValue(response);

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
