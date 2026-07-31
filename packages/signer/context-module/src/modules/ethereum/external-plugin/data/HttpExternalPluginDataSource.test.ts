import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import ABI from "@/modules/ethereum/external-plugin/__tests__/abi.json";
import {
  type Abis,
  type B2c,
  type B2cSignatures,
  type DAppDto,
} from "@/modules/ethereum/external-plugin/data/DAppDto";
import { type ExternalPluginDataSource } from "@/modules/ethereum/external-plugin/data/ExternalPluginDataSource";
import { HttpExternalPluginDataSource } from "@/modules/ethereum/external-plugin/data/HttpExternalPluginDataSource";

const config = {
  web3checks: {
    url: "web3checksUrl",
  },
  cal: {
    url: "https://global.api.prd.ledger.com/cal/v1",
  },
  originToken: "originToken",
} as ContextModuleServiceConfig;

describe("HttpExternalPuginDataSource", () => {
  let datasource: ExternalPluginDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
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

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpExternalPluginDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  const dappDtoResponse = (dto: Partial<DAppDto>[]) => dto as DAppDto[];

  it("should call the expected CAL URL with query params", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue([]);

    // WHEN
    await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/dapps",
      {
        params: {
          output: "b2c,b2c_signatures,abis",
          chain_id: 1,
          contracts: "0x0abc",
        },
      },
    );
  });

  it("should return undefined when no abis is undefined", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { abis: {}, b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
      ]),
    );

    // WHEN
    const result = await datasource.getDappInfos({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result.extract()).toEqual(undefined);
  });

  it("should return undefined when no abis data (duplicate case)", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { abis: {}, b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { abis, b2c: exampleB2c, b2c_signatures: exampleB2cSignatures },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([{ b2c: exampleB2c, abis: exampleAbis }]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { b2c, abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { b2c, abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { b2c, abis: exampleAbis, b2c_signatures: exampleB2cSignatures },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { b2c: exampleB2c, abis: exampleAbis, b2c_signatures: B2CSignature },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        { b2c: exampleB2c, abis: exampleAbis, b2c_signatures: B2CSignature },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        {
          b2c: exampleB2c,
          abis: exampleAbis,
          b2c_signatures: exampleB2cSignatures,
        },
      ]),
    );

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
    httpMock.get.mockResolvedValue(
      dappDtoResponse([
        {
          b2c: exampleB2c,
          abis: exampleAbis,
          b2c_signatures: exampleB2cSignatures,
        },
      ]),
    );

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

  it("should return an error when network client throws an error", async () => {
    // GIVEN
    httpMock.get.mockRejectedValue(new Error("error"));

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
