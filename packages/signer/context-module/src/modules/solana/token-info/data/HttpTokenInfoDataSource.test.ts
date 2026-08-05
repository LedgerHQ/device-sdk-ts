/* eslint-disable @typescript-eslint/no-explicit-any */
import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpTokenInfoDataSource } from "./HttpTokenInfoDataSource";
import { type TokenInfoDataSource } from "./TokenInfoDataSource";

describe("HttpTokenInfoDataSource", () => {
  let datasource: TokenInfoDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const network = "solana-mainnet";
  const config: ContextModuleServiceConfig = {
    cal: {
      url: "https://global.api.prd.ledger.com/cal/v1",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpTokenInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("calls /tokens with contract_address, network and ref params", async () => {
    httpMock.get.mockResolvedValue([
      {
        contract_address: mint,
        network: "solana-mainnet",
        descriptor: { data: "01020304", signatures: { prod: "p", test: "t" } },
      },
    ]);

    await datasource.getTokenInfo({ mint, network });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/tokens",
      {
        params: {
          contract_address: mint,
          network: "solana", // "solana-mainnet" mapped to the CAL short slug
          output: "contract_address,network,descriptor",
          ref: "branch:main",
        },
      },
    );
  });

  it("returns Right on success", async () => {
    httpMock.get.mockResolvedValue([
      {
        contract_address: mint,
        descriptor: {
          data: "01020304",
          signatures: { prod: "psig", test: "tsig" },
        },
      },
    ]);

    const result = await datasource.getTokenInfo({ mint, network });

    expect(result).toEqual(
      Right({
        mint,
        descriptor: {
          data: "01020304",
          signatures: { prod: "psig", test: "tsig" },
        },
      }),
    );
  });

  it("returns Left when response is empty", async () => {
    httpMock.get.mockResolvedValue([]);

    const result = await datasource.getTokenInfo({ mint, network });

    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpTokenInfoDataSource: no token info for mint ${mint}`,
        ),
      ),
    );
  });

  it("returns Left when descriptor is malformed", async () => {
    httpMock.get.mockResolvedValue([{ contract_address: mint } as any]);

    const result = await datasource.getTokenInfo({ mint, network });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpTokenInfoDataSource: malformed descriptor for mint ${mint}:`,
      ),
    );
  });

  it("returns Left when HTTP client throws", async () => {
    httpMock.get.mockRejectedValue(new Error("net"));

    const result = await datasource.getTokenInfo({ mint, network });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenInfoDataSource: Failed to fetch token info: net",
        ),
      ),
    );
  });
});
