/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from "axios";
import { Left, Right } from "purify-ts";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpSolanaLifiDataSource } from "./HttpSolanaLifiDataSource";
import {
  type GetTransactionDescriptorsResponse,
  type SolanaLifiDataSource,
} from "./SolanaLifiDataSource";

vi.mock("axios");

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("HttpSolanaLifiDataSource", () => {
  let datasource: SolanaLifiDataSource;
  const templateId = "tpl-123";
  const config: ContextModuleConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com/v1",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleConfig;

  beforeAll(() => {
    datasource = new HttpSolanaLifiDataSource(config, mockLoggerFactory);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call axios with the ledger client version header and correct params", async () => {
    // given
    const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
    vi.spyOn(axios, "request").mockImplementation(requestSpy);

    // when
    await datasource.getTransactionDescriptorsPayload({ templateId });

    // then
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: `${config.cal.url}/swap_templates`,
        params: {
          id: templateId,
          output: "id,chain_id,instructions,descriptors",
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      }),
    );
  });

  it("should return Right(data[0]) when axios responds with a non-empty array", async () => {
    // given
    const response0: GetTransactionDescriptorsResponse = {
      descriptors: {
        swap: { programId: "SwapProgram", accounts: [], data: "abcd" } as any,
      },
    } as any;

    vi.spyOn(axios, "request").mockResolvedValue({ data: [response0] });

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(Right(response0));
  });

  it("should return an error when data is undefined", async () => {
    // given
    vi.spyOn(axios, "request").mockResolvedValue({ data: undefined });

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpSolanaLifiDataSource: no transaction descriptors for id ${templateId}`,
        ),
      ),
    );
  });

  it("should return an error when data array is empty", async () => {
    // given
    vi.spyOn(axios, "request").mockResolvedValue({ data: [] });

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpSolanaLifiDataSource: no transaction descriptors for id ${templateId}`,
        ),
      ),
    );
  });

  it("should return an error when first element is falsy", async () => {
    // given
    vi.spyOn(axios, "request").mockResolvedValue({ data: [undefined] });

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpSolanaLifiDataSource: no transaction descriptors for id ${templateId}`,
        ),
      ),
    );
  });

  it("should return an error when axios throws", async () => {
    // given
    vi.spyOn(axios, "request").mockRejectedValue(new Error("network"));

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpSolanaLifiDataSource: Failed to fetch transaction descriptors",
        ),
      ),
    );
  });
});
