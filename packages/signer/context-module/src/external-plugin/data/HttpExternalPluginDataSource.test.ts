import axios from "axios";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import ABI from "@/external-plugin/__tests__/abi.json";
import {
  type Abis,
  type B2c,
  type B2cSignatures,
  type DAppDto,
} from "@/external-plugin/data/DAppDto";
import { type ExternalPluginDataSource } from "@/external-plugin/data/ExternalPluginDataSource";
import { HttpExternalPluginDataSource } from "@/external-plugin/data/HttpExternalPluginDataSource";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

vi.mock("axios");

const axiosResponseBuilder = (dto: Partial<DAppDto>[]) => {
  return { data: dto };
};

describe("HttpExternalPuginDataSource", () => {
  let datasource: ExternalPluginDataSource;
  const exampleB2c: B2c = {
    blockchainName: "ethereum",
    chainId: 1,
    contracts: [
      {
        address: "0x1ef",
        contractName: "otherName",
        selectors: {
          "0x01ee": {
            erc20OfInterest: ["fromToken"],
            method: "swap",
            plugin: "plugin",
          },
        },
      },
      {
        address: "0x0abc",
        contractName: "name",
        selectors: {
          "0x01ff": {
            erc20OfInterest: ["fromToken"],
            method: "swap",
            plugin: "plugin",
          },
        },
      },
    ],
    name: "test",
  };
  const exampleAbis: Abis = { "0x1ef": ABI, "0x0abc": ABI };
  const exampleB2cSignatures: B2cSignatures = {
    "0x1ef": {
      "0x01ee": {
        plugin: "plugin",
        serialized_data: "0x001",
        signature: "0x002",
      },
    },
    "0x0abc": {
      "0x01ff": {
        plugin: "plugin",
        serialized_data: "0x001",
        signature: "0x002",
      },
    },
  };

  beforeAll(() => {
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
      },
    } as ContextModuleConfig;
    datasource = new HttpExternalPluginDataSource(config);
    vi.clearAllMocks();
  });

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
    vi.spyOn(axios, "request").mockImplementation(requestSpy);

    // WHEN
    await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { [LEDGER_CLIENT_VERSION_HEADER]: version },
      }),
    );
  });

  it("should return undefined when no abis is undefined", async () => {
    // GIVEN
    const response = axiosResponseBuilder([
      { b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no selectors", async () => {
    // GIVEN
    const response = axiosResponseBuilder([
      { abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no abis data", async () => {
    // GIVEN
    const response = axiosResponseBuilder([
      { abis: {}, b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no abis data", async () => {
    // GIVEN
    const response = axiosResponseBuilder([
      { abis: {}, b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no abis data for the contract address", async () => {
    // GIVEN
    const abis: Abis = { "0x1": ABI };
    const response = axiosResponseBuilder([
      { abis, b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no b2c signature", async () => {
    // GIVEN
    const response = axiosResponseBuilder([
      { b2c: exampleB2c, abis: exampleAbis },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no ecc20OfInterest", async () => {
    // GIVEN
    const b2c = {
      blockchainName: "ethereum",
      chainId: 1,
      contracts: [
        {
          address: "0x0abc",
          contractName: "name",
          selectors: {
            "0x01ff": { method: "swap", plugin: "plugin" },
          },
        },
      ],
      name: "test",
    } as unknown as B2c;
    const response = axiosResponseBuilder([
      { b2c, abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no method", async () => {
    // GIVEN
    const b2c = {
      blockchainName: "ethereum",
      chainId: 1,
      contracts: [
        {
          address: "0x0abc",
          contractName: "name",
          selectors: {
            "0x01ff": { erc20OfInterest: ["fromToken"], plugin: "plugin" },
          },
        },
      ],
      name: "test",
    } as unknown as B2c;
    const response = axiosResponseBuilder([
      { b2c, abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no plugin", async () => {
    // GIVEN
    const b2c = {
      blockchainName: "ethereum",
      chainId: 1,
      contracts: [
        {
          address: "0x0abc",
          contractName: "name",
          selectors: {
            "0x01ff": { erc20OfInterest: ["fromToken"], method: "swap" },
          },
        },
      ],
      name: "test",
    } as unknown as B2c;
    const response = axiosResponseBuilder([
      { b2c, abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no method", async () => {
    // GIVEN
    const b2c = {
      blockchainName: "ethereum",
      chainId: 1,
      contracts: [
        {
          address: "0x0abc",
          contractName: "name",
          selectors: {
            "0x01ff": { erc20OfInterest: ["fromToken"], plugin: "plugin" },
          },
        },
      ],
      name: "test",
    } as unknown as B2c;
    const response = axiosResponseBuilder([
      { b2c, abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no signature", async () => {
    // GIVEN
    const B2CSignature = {
      "0x0abc": { "0x01ff": { plugin: "plugin", serialized_data: "0x001" } },
    } as unknown as B2cSignatures;

    // FIXME
    const response = axiosResponseBuilder([
      { b2c: exampleB2c, abis: exampleAbis, b2c_signatures: B2CSignature },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no serialized data", async () => {
    // GIVEN
    const B2CSignature = {
      "0x0abc": { "0x01ff": { plugin: "plugin", signature: "0x002" } },
    } as unknown as B2cSignatures;

    // FIXME
    const response = axiosResponseBuilder([
      { b2c: exampleB2c, abis: exampleAbis, b2c_signatures: B2CSignature },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return a correct response", async () => {
    // GIVEN
    const response = axiosResponseBuilder([
      {
        b2c: exampleB2c,
        abis: exampleAbis,
        b2c_signatures: exampleB2cSignatures,
      },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual({
      abi: ABI,
      selectorDetails: {
        erc20OfInterest: ["fromToken"],
        method: "swap",
        plugin: "plugin",
        serializedData: "0x001",
        signature: "0x002",
      },
    });
  });

  it("should normalize the address and selector", async () => {
    // GIVEN
    const response = axiosResponseBuilder([
      {
        b2c: exampleB2c,
        abis: exampleAbis,
        b2c_signatures: exampleB2cSignatures,
      },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0AbC",
      selector: "0x01Ff",
    });

    // THEN
    expect(result.extract()).toEqual({
      abi: ABI,
      selectorDetails: {
        erc20OfInterest: ["fromToken"],
        method: "swap",
        plugin: "plugin",
        serializedData: "0x001",
        signature: "0x002",
      },
    });
  });

  it("should return an error when axios throws an error", async () => {
    // GIVEN
    vi.spyOn(axios, "request").mockRejectedValue(new Error("error"));

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(
      new Error(
        "[ContextModule] HttpExternalPluginDataSource: Error fetching dapp infos",
      ),
    );
  });
});
