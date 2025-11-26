/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from "axios";
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

vi.mock("axios");

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

  it("should call axios with the ledger client version header and correct params", async () => {
    // given
    const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
    vi.spyOn(axios, "request").mockImplementation(requestSpy);

    // when
    await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: `${config.cal.url}/tokens`,
        params: expect.objectContaining({
          id: tokenInternalId,
          ref: `branch:${config.cal.branch}`,
        }),
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      }),
    );
  });

  it("should return Right(data[0]) when axios responds with a non-empty array", async () => {
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

    vi.spyOn(axios, "request").mockResolvedValue({ data: [response0] });

    // when
    const result = await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(result).toEqual(Right(response0));
  });

  describe.each`
    caseName                    | apiResponse
    ${"data is undefined"}      | ${{ data: undefined }}
    ${"data array is empty"}    | ${{ data: [] }}
    ${"first element is falsy"} | ${{ data: [undefined] }}
  `("Error cases", ({ caseName, apiResponse }) => {
    it(`should return an error when ${caseName}`, async () => {
      // given
      vi.spyOn(axios, "request").mockResolvedValue(apiResponse);

      // when
      const result = await datasource.getTokenInfosPayload({ tokenInternalId });

      // then
      expect(result).toEqual(Left(new Error(errorMessage(tokenInternalId))));
    });
  });

  it("should return an error when axios throws", async () => {
    // given
    vi.spyOn(axios, "request").mockRejectedValue(new Error("network"));

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
