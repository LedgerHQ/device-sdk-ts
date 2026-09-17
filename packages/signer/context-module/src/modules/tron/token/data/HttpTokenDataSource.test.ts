import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpTokenDataSource } from "./HttpTokenDataSource";
import { type TokenDataSource } from "./TokenDataSource";

describe("HttpTokenDataSource", () => {
  let datasource: TokenDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const assetId = "1002000";
  const config: ContextModuleServiceConfig = {
    cal: {
      url: "https://global.api.prd.ledger.com/cal/v1",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleServiceConfig;

  const response = (signatures: { prod: string; test: string }) => [
    {
      id: `tron/trc10/${assetId}`,
      ticker: "BTTOLD",
      decimals: 6,
      descriptor: { data: "", descriptorType: "token", signatures },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpTokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("should call http.get with the correct url and params", async () => {
    httpMock.get.mockResolvedValue([]);

    await datasource.getTokenInfosPayload({ assetId });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/tokens",
      {
        params: {
          id: "tron/trc10/1002000",
          output: "id,ticker,decimals,descriptor",
          ref: "branch:main",
        },
      },
    );
  });

  it("should return the signature matching the configured mode", async () => {
    httpMock.get.mockResolvedValue(
      response({ prod: "prod-sig", test: "test-sig" }),
    );

    const result = await datasource.getTokenInfosPayload({ assetId });

    expect(result).toEqual(Right("prod-sig"));
  });

  it("should return an error when no token matches", async () => {
    httpMock.get.mockResolvedValue([]);

    const result = await datasource.getTokenInfosPayload({ assetId });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: no token metadata for asset id 1002000",
        ),
      ),
    );
  });

  it("should return an error when the descriptor carries no signature", async () => {
    httpMock.get.mockResolvedValue(response({ prod: "", test: "test-sig" }));

    const result = await datasource.getTokenInfosPayload({ assetId });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: no token metadata for asset id 1002000",
        ),
      ),
    );
  });

  it.each([
    ["the response is not a list", { descriptor: {} }],
    ["an entry carries no descriptor", [{ id: `tron/trc10/${assetId}` }]],
    [
      "the descriptor carries no signature field",
      [{ descriptor: { data: "", descriptorType: "token" } }],
    ],
    [
      "a signature is not a string",
      [{ descriptor: { signatures: { prod: 42, test: "test-sig" } } }],
    ],
  ])("should return an error when %s", async (_case, payload) => {
    httpMock.get.mockResolvedValue(payload);

    const result = await datasource.getTokenInfosPayload({ assetId });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: no token metadata for asset id 1002000",
        ),
      ),
    );
  });

  it("should return an error when the request fails", async () => {
    httpMock.get.mockRejectedValue(new Error("network"));

    const result = await datasource.getTokenInfosPayload({ assetId });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: Failed to fetch token informations",
        ),
      ),
    );
  });
});
