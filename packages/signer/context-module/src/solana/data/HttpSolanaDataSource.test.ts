/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  base64StringToBuffer,
  DeviceModelId,
} from "@ledgerhq/device-management-kit";
import axios from "axios";
import { Left } from "purify-ts";

import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import { HttpSolanaDataSource } from "@/solana/data/HttpSolanaDataSource";
import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import PACKAGE from "@root/package.json";

vi.mock("axios");

const createCertificateLoaderMock = () => ({
  loadCertificate: vi.fn().mockResolvedValue({
    descriptor: "Y2VydC1ibG9i",
    signature: "Y2VydC1zaWduYXR1cmU=",
  }),
});

describe("HttpSolanaDataSource", () => {
  const config = {
    web3checks: {
      url: "https://some.doma.in",
    },
    originToken: "mock-origin-token",
  } as ContextModuleConfig;

  const certificate = {
    descriptor: "Y2VydC1ibG9i",
    signature: "Y2VydC1zaWduYXR1cmU=",
  };

  const signedDescriptorBase64 = btoa("mock-descriptor");
  const responseData = {
    tokenAccount: "token-account",
    owner: "owner-address",
    contract: "contract-address",
    signedDescriptor: signedDescriptorBase64,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should fetch address metadata via tokenAddress", async () => {
    // given
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };
    const workingCertLoader = createCertificateLoaderMock();
    vi.spyOn(axios, "request").mockResolvedValueOnce({ data: responseData });

    // when
    const dataSource = new HttpSolanaDataSource(config, workingCertLoader);
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      descriptor: base64StringToBuffer(signedDescriptorBase64),
      certificate,
      tokenAccount: "token-account",
      owner: "owner-address",
      contract: "contract-address",
    });
  });

  it("should compute address when tokenAddress is not provided", async () => {
    // given
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: {
        address: "some-address",
        mintAddress: "some-mint",
      },
    };
    const workingCertLoader = createCertificateLoaderMock();
    vi.spyOn(axios, "request").mockResolvedValueOnce({ data: responseData });

    // when
    const dataSource = new HttpSolanaDataSource(config, workingCertLoader);
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result.isRight()).toBe(true);
    expect((result.extract() as any).tokenAccount).toBe("token-account");
  });

  it("should return an error if both tokenAddress and createATA are missing", async () => {
    // given
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: undefined,
    };

    // when
    const dataSource = new HttpSolanaDataSource(
      config,
      createCertificateLoaderMock(),
    );
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: either tokenAddress or createATA must be provided",
        ),
      ),
    );
  });

  it("should return an error if ATA inputs are incomplete", async () => {
    // given
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: {
        address: undefined as any,
        mintAddress: undefined as any,
      },
    };

    // when
    const dataSource = new HttpSolanaDataSource(
      config,
      createCertificateLoaderMock(),
    );
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: missing address or mintAddress for ATA computation",
        ),
      ),
    );
  });

  it("should return an error if the descriptor is not valid base64", async () => {
    // given
    vi.spyOn(axios, "request").mockResolvedValueOnce({
      data: { ...responseData, signedDescriptor: "!!!not-valid-base64!!!" },
    });
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    // when
    const dataSource = new HttpSolanaDataSource(
      config,
      createCertificateLoaderMock(),
    );
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: invalid base64 descriptor received",
        ),
      ),
    );
  });

  it("should return an error if CAL certificate is undefined", async () => {
    // given
    vi.spyOn(axios, "request").mockResolvedValueOnce({ data: responseData });
    const failingCertLoader = {
      loadCertificate: vi.fn().mockResolvedValue(undefined),
    };
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    // when
    const dataSource = new HttpSolanaDataSource(
      config,
      failingCertLoader as any,
    );
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: CAL certificate is undefined",
        ),
      ),
    );
  });

  it("should return an error if the metadata request fails", async () => {
    // given
    vi.spyOn(axios, "request").mockRejectedValueOnce(
      new Error("Network error"),
    );
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    // when
    const dataSource = new HttpSolanaDataSource(
      config,
      createCertificateLoaderMock(),
    );
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: Failed to fetch Solana address metadata",
        ),
      ),
    );
  });

  it("should return an error if CAL certificate throws", async () => {
    // given
    vi.spyOn(axios, "request").mockResolvedValueOnce({ data: responseData });
    const throwingCertLoader = {
      loadCertificate: vi.fn().mockRejectedValue(new Error("CAL error")),
    };
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    // when
    const dataSource = new HttpSolanaDataSource(
      config,
      throwingCertLoader as any,
    );
    const result = await dataSource.getSolanaContext(context);

    // then
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: failed to load CAL certificate",
        ),
      ),
    );
  });

  it("should throw if originToken is missing", () => {
    // given / when / then
    expect(() => {
      new HttpSolanaDataSource(
        { ...config, originToken: undefined },
        createCertificateLoaderMock(),
      );
    }).toThrow(
      "[ContextModule] - HttpSolanaDataSource: origin token is required",
    );
  });

  it("should call axios with correct headers", async () => {
    // given
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };
    const spy = vi
      .spyOn(axios, "request")
      .mockResolvedValueOnce({ data: responseData });

    // when
    const dataSource = new HttpSolanaDataSource(
      config,
      createCertificateLoaderMock(),
    );
    await dataSource.getSolanaContext(context);

    // then
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
