/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpLifiDataSource } from "./HttpLifiDataSource";
import {
  type GetTransactionDescriptorsResponse,
  type LifiDataSource,
} from "./LifiDataSource";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("HttpLifiDataSource", () => {
  let datasource: LifiDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const templateId = "tpl-123";
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
    datasource = new HttpLifiDataSource(
      config,
      mockLoggerFactory,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("should call the network client with the expected URL and params", async () => {
    // given
    httpMock.get.mockResolvedValue([]);

    // when
    await datasource.getTransactionDescriptorsPayload({ templateId });

    // then
    expect(httpMock.get).toHaveBeenCalledTimes(1);
    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/swap_templates",
      {
        params: {
          template_id: templateId,
          output: "id,chain_id,instructions,descriptors",
        },
      },
    );
  });

  it("should return Right(data[0]) when the network client responds with a non-empty array", async () => {
    // given
    const response0: GetTransactionDescriptorsResponse = {
      descriptors: {
        swap: { programId: "SwapProgram", accounts: [], data: "abcd" } as any,
      },
    } as any;

    httpMock.get.mockResolvedValue([response0]);

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(Right(response0));
  });

  it("should return an error when data is undefined", async () => {
    // given
    httpMock.get.mockResolvedValue(null);

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpLifiDataSource: no transaction descriptors for id ${templateId}`,
        ),
      ),
    );
  });

  it("should return an error when data array is empty", async () => {
    // given
    httpMock.get.mockResolvedValue([]);

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpLifiDataSource: no transaction descriptors for id ${templateId}`,
        ),
      ),
    );
  });

  it("should return an error when first element is falsy", async () => {
    // given
    httpMock.get.mockResolvedValue([null]);

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpLifiDataSource: no transaction descriptors for id ${templateId}`,
        ),
      ),
    );
  });

  it("should return an error when the network client throws", async () => {
    // given
    httpMock.get.mockRejectedValue(new Error("network"));

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpLifiDataSource: Failed to fetch transaction descriptors",
        ),
      ),
    );
  });
});
