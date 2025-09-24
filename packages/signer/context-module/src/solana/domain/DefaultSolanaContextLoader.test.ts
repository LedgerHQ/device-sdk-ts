/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KeyUsage } from "@/pki/model/KeyUsage";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { DefaultSolanaContextLoader } from "@/solana/domain/DefaultSolanaContextLoader";
import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

describe("DefaultSolanaContextLoader", () => {
  let mockDataSource: { getOwnerInfo: ReturnType<typeof vi.fn> };
  let mockCertLoader: { loadCertificate: ReturnType<typeof vi.fn> };
  let mockTokenLoader: {
    canHandle: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
  };
  let mockLifiLoader: {
    canHandle: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
  };

  let loader: DefaultSolanaContextLoader;

  const baseContext: SolanaTransactionContext = {
    deviceModelId: DeviceModelId.FLEX,
    tokenAddress: "token-addr",
    challenge: "challenge-str",
  } as any;

  const bytes = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);

  const fakeCert = {
    keyUsageNumber: 0,
    payload: bytes,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mockDataSource = { getOwnerInfo: vi.fn() };
    mockCertLoader = { loadCertificate: vi.fn() };
    mockTokenLoader = {
      canHandle: vi.fn().mockReturnValue(false),
      load: vi.fn(),
    };
    mockLifiLoader = {
      canHandle: vi.fn().mockReturnValue(false),
      load: vi.fn(),
    };

    loader = new DefaultSolanaContextLoader(
      mockDataSource as any,
      mockCertLoader as any,
      mockTokenLoader as any,
      mockLifiLoader as any,
    );
  });

  it("calls certificate loader (TrustedName) and owner info with correct args", async () => {
    // given
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: bytes,
        tokenAccount: "tkn",
        owner: "own",
        contract: "ctr",
      }),
    );

    // when
    await loader.load(baseContext);

    // then
    expect(mockCertLoader.loadCertificate).toHaveBeenCalledTimes(1);
    expect(mockCertLoader.loadCertificate).toHaveBeenCalledWith({
      keyId: "domain_metadata_key",
      keyUsage: KeyUsage.TrustedName,
      targetDevice: baseContext.deviceModelId,
    });
    expect(mockDataSource.getOwnerInfo).toHaveBeenCalledWith(baseContext);
  });

  it("propagates Left from getOwnerInfo", async () => {
    // given
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    const dsError = new Error("DS failure");
    mockDataSource.getOwnerInfo.mockResolvedValue(Left(dsError));

    // when
    const result = await loader.load(baseContext);

    // then
    expect(result).toEqual(Left(dsError));
  });

  it("returns Right with merged owner info + certificate; skips loaders that can't handle", async () => {
    // given
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: bytes,
        tokenAccount: "tokenAcct",
        owner: "ownerAddr",
        contract: "contractAddr",
      }),
    );

    // when
    const result = await loader.load(baseContext);

    // then
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      certificate: fakeCert,
      descriptor: bytes,
      tokenAccount: "tokenAcct",
      owner: "ownerAddr",
      contract: "contractAddr",
      loadersResults: [],
    });

    expect(mockTokenLoader.canHandle).toHaveBeenCalledWith(baseContext);
    expect(mockLifiLoader.canHandle).toHaveBeenCalledWith(baseContext);
    expect(mockTokenLoader.load).not.toHaveBeenCalled();
    expect(mockLifiLoader.load).not.toHaveBeenCalled();
  });

  it("runs eligible loaders and collects their fulfilled results (order preserved)", async () => {
    // given
    const ctx: SolanaTransactionContext = {
      ...baseContext,
      templateId: "tpl-1",
      tokenInternalId: "sol:usdc",
    } as any;

    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: bytes,
        tokenAccount: "acct2",
        owner: "own2",
        contract: "ctr2",
      }),
    );

    const tokenResult = {
      type: ClearSignContextType.SOLANA_TOKEN,
      payload: { solanaTokenDescriptor: { data: "X", signature: "Y" } },
    };
    const lifiResult = {
      type: ClearSignContextType.SOLANA_LIFI,
      payload: {
        "11111111111111111111111111111111": {
          data: "1010",
          descriptorType: "swap_template",
          descriptorVersion: "v1",
          signatures: {
            prod: "f0cacc1a",
            test: "f0cacc1a",
          },
        },
        SOMEkey: {
          data: "1010",
          descriptorType: "swap_template",
          descriptorVersion: "v1",
          signatures: {
            prod: "f0cacc1a",
            test: "f0cacc1a",
          },
        },
      },
    };

    mockTokenLoader.canHandle.mockReturnValue(true);
    mockLifiLoader.canHandle.mockReturnValue(true);
    mockTokenLoader.load.mockResolvedValue(tokenResult);
    mockLifiLoader.load.mockResolvedValue(lifiResult);

    // when
    const result = await loader.load(ctx);

    // then
    expect(result.isRight()).toBe(true);
    const value = result.extract();
    expect(value).toMatchObject({
      certificate: fakeCert,
      descriptor: bytes,
      tokenAccount: "acct2",
      owner: "own2",
      contract: "ctr2",
      loadersResults: [tokenResult, lifiResult],
    });

    expect(mockTokenLoader.canHandle).toHaveBeenCalledWith(ctx);
    expect(mockTokenLoader.load).toHaveBeenCalledWith(ctx);
    expect(mockLifiLoader.canHandle).toHaveBeenCalledWith(ctx);
    expect(mockLifiLoader.load).toHaveBeenCalledWith(ctx);
  });

  it("ignores rejected optional loaders and still succeeds", async () => {
    // given
    const ctx: SolanaTransactionContext = {
      ...baseContext,
      templateId: "tpl-x",
      tokenInternalId: "sol:usdt",
    } as any;

    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: bytes,
        tokenAccount: "acctx",
        owner: "ownx",
        contract: "ctrx",
      }),
    );

    const lifiResult = {
      type: ClearSignContextType.SOLANA_LIFI,
      payload: {
        "11111111111111111111111111111111": {
          data: "1010",
          descriptorType: "swap_template",
          descriptorVersion: "v1",
          signatures: {
            prod: "f0cacc1a",
            test: "f0cacc1a",
          },
        },
      },
    };

    mockTokenLoader.canHandle.mockReturnValue(true);
    mockLifiLoader.canHandle.mockReturnValue(true);
    mockTokenLoader.load.mockRejectedValue(new Error("token loader failure"));
    mockLifiLoader.load.mockResolvedValue(lifiResult);

    // when
    const result = await loader.load(ctx);

    // then
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      certificate: fakeCert,
      descriptor: bytes,
      tokenAccount: "acctx",
      owner: "ownx",
      contract: "ctrx",
      loadersResults: [lifiResult], // rejected one omitted
    });
  });

  it("succeeds even when certificate loader returns undefined (certificate omitted)", async () => {
    // given: current implementation doesn't turn this into a Left
    mockCertLoader.loadCertificate.mockResolvedValue(undefined);
    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: bytes,
        tokenAccount: "tkn",
        owner: "own",
        contract: "ctr",
      }),
    );

    // when
    const result = await loader.load(baseContext);

    // then
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      certificate: undefined,
      descriptor: bytes,
      tokenAccount: "tkn",
      owner: "own",
      contract: "ctr",
      loadersResults: [],
    });
  });
});
