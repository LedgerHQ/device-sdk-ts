/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Left, Right } from "purify-ts";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpSolanaTokenDataSource } from "./HttpSolanaTokenDataSource";
import {
  type SolanaTokenDataSource,
  type TokenDataResponse,
} from "./SolanaTokenDataSource";

describe("HttpSolanaTokenDataSource", () => {
  let datasource: SolanaTokenDataSource;
  const tokenInternalId = "sol:usdc";
  const config: ContextModuleConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com/v1",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleConfig;

  const errorMessage = (id: string) =>
    `[ContextModule] HttpSolanaTokenDataSource: no token metadata for id ${id}`;

  beforeAll(() => {
    datasource = new HttpSolanaTokenDataSource(config);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call fetch with the ledger client version header and correct params", async () => {
    // given
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([])),
    );

    // when
    await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      }),
    );
  });

  it("should return Right(data[0]) when fetch responds with a non-empty array", async () => {
    // given
    const response0: TokenDataResponse = {
      descriptor: {
        data: "ABCD",
        signatures: {
          prod: "SIG-PROD",
          test: "SIG-TEST",
        } as any,
      },
    } as any;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([response0])),
    );

    // when
    const result = await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(result).toEqual(Right(response0));
  });

  describe.each`
    caseName                    | responseBody
    ${"data is undefined"}      | ${"null"}
    ${"data array is empty"}    | ${JSON.stringify([])}
    ${"first element is falsy"} | ${JSON.stringify([null])}
  `("Error cases", ({ caseName, responseBody }) => {
    it(`should return an error when ${caseName}`, async () => {
      // given
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(responseBody as string),
      );

      // when
      const result = await datasource.getTokenInfosPayload({ tokenInternalId });

      // then
      expect(result).toEqual(Left(new Error(errorMessage(tokenInternalId))));
    });
  });

  it("should return an error when fetch throws", async () => {
    // given
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    // when
    const result = await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpSolanaTokenDataSource: Failed to fetch token informations",
        ),
      ),
    );
  });
});
