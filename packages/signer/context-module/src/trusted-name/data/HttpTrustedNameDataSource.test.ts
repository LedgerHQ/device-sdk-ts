import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpTrustedNameDataSource } from "@/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import PACKAGE from "@root/package.json";

jest.mock("axios");

describe("HttpTrustedNameDataSource", () => {
  let datasource: TrustedNameDataSource;

  beforeAll(() => {
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "prod",
        branch: "main",
      },
    } as ContextModuleConfig;
    datasource = new HttpTrustedNameDataSource(config);
    jest.clearAllMocks();
  });

  describe("getDomainNamePayload", () => {
    it("should call axios with the ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = jest.fn(() => Promise.resolve({ data: [] }));
      jest.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getDomainNamePayload({
        challenge: "",
        domain: "hello.eth",
      });

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-Ledger-Client-Version": version },
        }),
      );
    });

    it("should throw an error when axios throws an error", async () => {
      // GIVEN
      jest.spyOn(axios, "request").mockRejectedValue(new Error());

      // WHEN
      const result = await datasource.getDomainNamePayload({
        challenge: "",
        domain: "hello.eth",
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: Failed to fetch domain name",
          ),
        ),
      );
    });

    it("should return an error when no payload is returned", async () => {
      // GIVEN
      const response = { data: { test: "" } };
      jest.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getDomainNamePayload({
        challenge: "",
        domain: "hello.eth",
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: error getting domain payload",
          ),
        ),
      );
    });

    it("should return a payload", async () => {
      // GIVEN
      const response = { data: { signedDescriptor: { data: "payload" } } };
      jest.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getDomainNamePayload({
        challenge: "challenge",
        domain: "hello.eth",
      });

      // THEN
      expect(result).toEqual(Right("payload"));
    });
  });

  describe("getTrustedNamePayload", () => {
    it("should call axios with the ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = jest.fn(() => Promise.resolve({ data: [] }));
      jest.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getTrustedNamePayload({
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-Ledger-Client-Version": version },
        }),
      );
    });

    it("should throw an error when axios throws an error", async () => {
      // GIVEN
      jest.spyOn(axios, "request").mockRejectedValue(new Error());

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: Failed to fetch trusted name",
          ),
        ),
      );
    });

    it("should return an error when no payload is returned", async () => {
      // GIVEN
      const response = { data: { test: "" } };
      jest.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: no trusted name metadata for address 0x1234",
          ),
        ),
      );
    });

    it("should return a payload", async () => {
      // GIVEN
      const response = {
        data: {
          signedDescriptor: { data: "payload" },
        },
      };
      jest.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(Right("payload"));
    });

    it("should return a payload with a signature", async () => {
      // GIVEN
      const response = {
        data: {
          signedDescriptor: { data: "payload", signatures: { prod: "12345" } },
        },
      };
      jest.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(Right("payload153012345"));
    });
  });
});
