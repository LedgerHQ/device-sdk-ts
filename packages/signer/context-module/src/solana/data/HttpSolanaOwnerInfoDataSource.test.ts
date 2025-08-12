/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DeviceModelId,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import axios from "axios";
import { Left } from "purify-ts";

import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import { HttpSolanaOwnerInfoDataSource } from "@/solana/data/HttpSolanaOwnerInfoDataSource";
import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import PACKAGE from "@root/package.json";

vi.mock("axios");

function stringToHex(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str); // Uint8Array
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("HttpSolanaOwnerInfoDataSource", () => {
  const config = {
    metadataServiceDomain: { url: "https://some.doma.in" },
    originToken: "mock-origin-token",
  } as ContextModuleConfig;

  const signedDescriptorHex = stringToHex("mock-descriptor");
  const responseData = {
    tokenAccount: "token-account",
    owner: "owner-address",
    contract: "contract-address",
    signedDescriptor: signedDescriptorHex,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should fetch address metadata via tokenAddress", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };
    vi.spyOn(axios, "request").mockResolvedValueOnce({ data: responseData });

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      descriptor: hexaStringToBuffer(signedDescriptorHex),
      tokenAccount: "token-account",
      owner: "owner-address",
      contract: "contract-address",
    });
  });

  it("should compute address when tokenAddress is not provided", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: {
        address: "some-address",
        mintAddress: "some-mint",
      },
    };
    vi.spyOn(axios, "request").mockResolvedValueOnce({ data: responseData });

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result.isRight()).toBe(true);
    expect((result.extract() as any).tokenAccount).toBe("token-account");
  });

  it("should return an error if both tokenAddress and createATA are missing or invalid", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: either tokenAddress or valid createATA must be provided",
        ),
      ),
    );
  });

  it("should return an error if challenge is missing", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: undefined,
      createATA: undefined,
    };

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: challenge is required",
        ),
      ),
    );
  });

  it("should return an error if the descriptor is not valid base64", async () => {
    vi.spyOn(axios, "request").mockResolvedValueOnce({
      data: { ...responseData, signedDescriptor: "!!!not-valid-base64!!!" },
    });
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: invalid base64 descriptor received",
        ),
      ),
    );
  });

  it("should return an error if the metadata request fails", async () => {
    vi.spyOn(axios, "request").mockRejectedValueOnce(
      new Error("Network error"),
    );
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: Failed to fetch address metadata",
        ),
      ),
    );
  });

  it("should return an error if axios request return wrong shape for fetchAddressMetadata", async () => {
    vi.spyOn(axios, "request").mockResolvedValueOnce({
      data: { wrong: "field" },
    });

    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: invalid fetchAddressMetadata response shape",
        ),
      ),
    );
  });

  it("should return an error if axios request return wrong shape for computeAddressMetadata", async () => {
    vi.spyOn(axios, "request").mockResolvedValueOnce({
      data: { wrong: "field" },
    });

    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: {
        address: "some-address",
        mintAddress: "some-mint",
      },
    };

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaOwnerInfoDataSource: invalid computeAddressMetadata response shape",
        ),
      ),
    );
  });

  it("should throw if originToken is missing", () => {
    expect(() => {
      new HttpSolanaOwnerInfoDataSource({
        ...config,
        originToken: undefined,
      } as any);
    }).toThrow(
      "[ContextModule] - HttpSolanaOwnerInfoDataSource: origin token is required",
    );
  });

  it("should call axios with correct headers", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };
    const spy = vi
      .spyOn(axios, "request")
      .mockResolvedValueOnce({ data: responseData });

    const dataSource = new HttpSolanaOwnerInfoDataSource(config);
    await dataSource.getOwnerInfo(context);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          "X-Ledger-Client-Origin": config.originToken,
        },
      }),
    );
  });
});
