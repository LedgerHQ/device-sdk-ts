/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    datasource = new HttpSolanaLifiDataSource(config);
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
    await datasource.getTransactionDescriptorsPayload({ templateId });

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
    const response0: GetTransactionDescriptorsResponse = {
      descriptors: {
        swap: { programId: "SwapProgram", accounts: [], data: "abcd" } as any,
      },
    } as any;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([response0])),
    );

    // when
    const result = await datasource.getTransactionDescriptorsPayload({
      templateId,
    });

    // then
    expect(result).toEqual(Right(response0));
  });

  it("should return an error when data is undefined", async () => {
    // given
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("null"));

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
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([])),
    );

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
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([null])),
    );

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

  it("should return an error when fetch throws", async () => {
    // given
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

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
