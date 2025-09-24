/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KeyUsage } from "@/pki/model/KeyUsage";
import { DefaultSolanaContextLoader } from "@/solana/domain/DefaultSolanaContextLoader";
import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

describe("DefaultSolanaContextLoader", () => {
  let mockDataSource: { getOwnerInfo: ReturnType<typeof vi.fn> };
  let mockCertLoader: { loadCertificate: ReturnType<typeof vi.fn> };
  let mockTokenLoader: {
    canHandle: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
  };
  let loader: DefaultSolanaContextLoader;

  const baseContext: SolanaTransactionContext = {
    deviceModelId: DeviceModelId.FLEX,
    tokenAddress: "token-addr",
    challenge: "challenge-str",
  } as any;

  const fakeCert = {
    descriptor: "cert-desc",
    signature: "cert-sig",
    keyUsageNumber: 0,
    payload: new Uint8Array(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mockDataSource = { getOwnerInfo: vi.fn() };
    mockCertLoader = { loadCertificate: vi.fn() };
    mockTokenLoader = {
      canHandle: vi.fn().mockReturnValue(false),
      load: vi.fn(),
    };

    loader = new DefaultSolanaContextLoader(
      mockDataSource as any,
      mockCertLoader as any,
      mockTokenLoader as any,
    );
  });

  it("calls CAL certificate loader and owner info with correct args", async () => {
    // GIVEN
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: Buffer.from("d"),
        tokenAccount: "tkn",
        owner: "own",
        contract: "ctr",
      }),
    );

    // WHEN
    await loader.load(baseContext);

    // THEN
    expect(mockCertLoader.loadCertificate).toHaveBeenCalledTimes(1);
    expect(mockCertLoader.loadCertificate).toHaveBeenCalledWith({
      keyId: "domain_metadata_key",
      keyUsage: KeyUsage.TrustedName,
      targetDevice: baseContext.deviceModelId,
    });
    expect(mockDataSource.getOwnerInfo).toHaveBeenCalledWith(baseContext);
  });

  it("returns Left if CAL certificate is undefined", async () => {
    // GIVEN
    mockCertLoader.loadCertificate.mockResolvedValue(undefined);

    // WHEN
    const result = await loader.load(baseContext);

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - DefaultSolanaContextLoader: CAL certificate is undefined",
        ),
      ),
    );
  });

  it("propagates Left from getOwnerInfo", async () => {
    // GIVEN
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    const dsError = new Error("DS failure");
    mockDataSource.getOwnerInfo.mockResolvedValue(Left(dsError));

    // WHEN
    const result = await loader.load(baseContext);

    // THEN
    expect(result).toEqual(Left(dsError));
  });

  it("returns Right with merged owner info + CAL cert; no optional loaders run", async () => {
    // GIVEN
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: Buffer.from("dd"),
        tokenAccount: "tokenAcct",
        owner: "ownerAddr",
        contract: "contractAddr",
      }),
    );

    // WHEN
    const result = await loader.load(baseContext);

    // THEN
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      certificate: fakeCert,
      descriptor: Buffer.from("dd"),
      tokenAccount: "tokenAcct",
      owner: "ownerAddr",
      contract: "contractAddr",
      loadersResults: [],
    });

    // token loader was checked but not run
    expect(mockTokenLoader.canHandle).toHaveBeenCalledWith(baseContext);
    expect(mockTokenLoader.load).not.toHaveBeenCalled();

    // coin meta loader not invoked (no tokenInternalId)
    expect(mockCertLoader.loadCertificate).toHaveBeenCalledTimes(1); // only CAL
  });

  it("runs eligible loaders and collects their results in order", async () => {
    // GIVEN: tokenInternalId present => coin meta loader eligible
    const ctx: SolanaTransactionContext = {
      ...baseContext,
      tokenInternalId: "sol:usdc",
    } as any;

    // CAL (first call) + CoinMeta (second call)
    const coinMetaCert = { ...fakeCert, keyUsageNumber: 1 };
    mockCertLoader.loadCertificate
      .mockResolvedValueOnce(fakeCert) // CAL
      .mockResolvedValueOnce(coinMetaCert); // CoinMeta

    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: Buffer.from("d2"),
        tokenAccount: "acct2",
        owner: "own2",
        contract: "ctr2",
      }),
    );

    // Token loader eligible and returns a value
    const tokenResult = { type: "SOLANA_TOKEN", payload: { foo: "bar" } };
    mockTokenLoader.canHandle.mockReturnValue(true);
    mockTokenLoader.load.mockResolvedValue(tokenResult);

    // WHEN
    const result = await loader.load(ctx);

    // THEN
    expect(result.isRight()).toBe(true);
    const value = result.extract();
    expect(value).toMatchObject({
      certificate: fakeCert,
      descriptor: Buffer.from("d2"),
      tokenAccount: "acct2",
      owner: "own2",
      contract: "ctr2",
    });

    // loadersResults contains token result then coin meta cert (matches loaders order)
    expect((value as any).loadersResults).toEqual([tokenResult, coinMetaCert]);

    // CAL cert call
    expect(mockCertLoader.loadCertificate).toHaveBeenNthCalledWith(1, {
      keyId: "domain_metadata_key",
      keyUsage: KeyUsage.TrustedName,
      targetDevice: ctx.deviceModelId,
    });
    // CoinMeta cert call
    expect(mockCertLoader.loadCertificate).toHaveBeenNthCalledWith(2, {
      keyId: "token_metadata_key",
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: ctx.deviceModelId,
    });

    expect(mockTokenLoader.canHandle).toHaveBeenCalledWith(ctx);
    expect(mockTokenLoader.load).toHaveBeenCalledWith(ctx);
  });

  it("ignores rejected optional loaders and still succeeds", async () => {
    // GIVEN: only coin meta is eligible and it fails
    const ctx: SolanaTransactionContext = {
      ...baseContext,
      tokenInternalId: "sol:usdt",
    } as any;

    mockCertLoader.loadCertificate
      .mockResolvedValueOnce(fakeCert) // CAL
      .mockRejectedValueOnce(new Error("coin meta failure")); // CoinMeta fails

    mockDataSource.getOwnerInfo.mockResolvedValue(
      Right({
        descriptor: Buffer.from("dx"),
        tokenAccount: "acctx",
        owner: "ownx",
        contract: "ctrx",
      }),
    );

    mockTokenLoader.canHandle.mockReturnValue(false); // token loader skipped

    // WHEN
    const result = await loader.load(ctx);
    const value = result.extract();

    // THEN
    expect(value).toMatchObject({
      certificate: fakeCert,
      descriptor: Buffer.from("dx"),
      tokenAccount: "acctx",
      owner: "ownx",
      contract: "ctrx",
      loadersResults: [], // failed optional loader omitted
    });
  });
});
