import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpMintToIdDataSource } from "./HttpMintToIdDataSource";

describe("HttpMintToIdDataSource", () => {
  let datasource: HttpMintToIdDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  const mintAddress = "3iql8bfs2Ve7mwW4EHaqqHasbmrnCrPxiZWat2ZFyr9Y";
  const config = {
    cal: {
      url: "https://global.api.prd.ledger.com/cal/v1",
      branch: "main",
    },
  } as ContextModuleServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpMintToIdDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("calls the correct endpoint with the right params", async () => {
    httpMock.get.mockResolvedValue([{ id: "sol:usdc" }]);

    await datasource.getIdFromMint({ mintAddress });

    expect(httpMock.get).toHaveBeenCalledWith(`${config.cal.url}/tokens`, {
      params: {
        contract_address: mintAddress,
        network: "solana",
        output: "id",
        ref: `branch:${config.cal.branch}`,
      },
    });
  });

  it("returns Right with id when response contains a token", async () => {
    httpMock.get.mockResolvedValue([{ id: "sol:usdc" }]);

    const result = await datasource.getIdFromMint({ mintAddress });

    expect(result.isRight()).toBe(true);
    expect(result.extract()).toBe("sol:usdc");
  });

  it("returns Left when response is an empty array", async () => {
    httpMock.get.mockResolvedValue([]);

    const result = await datasource.getIdFromMint({ mintAddress });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toContain(
      `no token id found for mint ${mintAddress}`,
    );
  });

  it("returns Left when response entry has no id field", async () => {
    httpMock.get.mockResolvedValue([{}]);

    const result = await datasource.getIdFromMint({ mintAddress });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toContain(
      `no token id found for mint ${mintAddress}`,
    );
  });

  it("returns Left when http.get throws", async () => {
    httpMock.get.mockRejectedValue(new Error("network error"));

    const result = await datasource.getIdFromMint({ mintAddress });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toContain(
      "failed to fetch token id from mint address",
    );
  });
});
