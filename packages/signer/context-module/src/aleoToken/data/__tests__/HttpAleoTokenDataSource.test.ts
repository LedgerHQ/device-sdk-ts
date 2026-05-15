/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpAleoTokenDataSource } from "../HttpAleoTokenDataSource";
import {
  type AleoTokenDataResponse,
  type AleoTokenDataSource,
} from "../AleoTokenDataSource";

describe("HttpAleoTokenDataSource", () => {
  let datasource: AleoTokenDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const tokenInternalId = "aleo:usdc";
  const config: ContextModuleServiceConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com/v1",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleServiceConfig;

  const errorMessage = (id: string) =>
    `[ContextModule] HttpAleoTokenDataSource: no token metadata for id ${id}`;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpAleoTokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("should call http.get with the correct url and params", async () => {
    // given
    httpMock.get.mockResolvedValue([]);

    // when
    await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(httpMock.get).toHaveBeenCalledTimes(1);
    expect(httpMock.get).toHaveBeenCalledWith(`${config.cal.url}/tokens`, {
      params: {
        id: tokenInternalId,
        output:
          "id,name,network,network_family,network_type,ticker,decimals,blockchain_name,chain_id,contract_address,descriptor,units,symbol",
        ref: `branch:${config.cal.branch}`,
      },
    });
  });

  it("should return Right(data[0]) when http.get responds with a non-empty array", async () => {
    // given
    const response0: AleoTokenDataResponse = {
      descriptor: {
        data: "ABCD",
        signatures: {
          prod: "SIG-PROD",
          test: "SIG-TEST",
        },
      },
    };

    httpMock.get.mockResolvedValue([response0]);

    // when
    const result = await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(result).toEqual(Right(response0));
  });

  describe.each`
    caseName                    | responseBody
    ${"data is undefined"}      | ${null}
    ${"data array is empty"}    | ${[]}
    ${"first element is falsy"} | ${[null]}
  `("Error cases", ({ caseName, responseBody }) => {
    it(`should return an error when ${caseName}`, async () => {
      // given
      httpMock.get.mockResolvedValue(responseBody);

      // when
      const result = await datasource.getTokenInfosPayload({ tokenInternalId });

      // then
      expect(result).toEqual(Left(new Error(errorMessage(tokenInternalId))));
    });
  });

  it("should return an error when http.get throws", async () => {
    // given
    httpMock.get.mockRejectedValue(new Error("network"));

    // when
    const result = await datasource.getTokenInfosPayload({ tokenInternalId });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpAleoTokenDataSource: Failed to fetch token informations",
        ),
      ),
    );
  });
});
