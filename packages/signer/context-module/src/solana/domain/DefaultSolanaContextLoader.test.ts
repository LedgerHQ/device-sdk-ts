/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { KeyUsage } from "@/pki/model/KeyUsage";
import { DefaultSolanaContextLoader } from "@/solana/domain/DefaultSolanaContextLoader";
import type {
  SolanaTransactionContext,
  SolanaTransactionContextResultSuccess,
} from "@/solana/domain/solanaContextTypes";

describe("DefaultSolanaContextLoader", () => {
  let mockDataSource: {
    getSolanaContext: any;
  };
  let mockCertLoader: {
    loadCertificate: any;
  };
  let loader: DefaultSolanaContextLoader;

  const context: SolanaTransactionContext = {
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
    mockDataSource = {
      getSolanaContext: vi.fn(),
    };
    mockCertLoader = {
      loadCertificate: vi.fn(),
    };

    loader = new DefaultSolanaContextLoader(
      mockDataSource as any,
      mockCertLoader as any,
    );
  });

  it("should call dataSource.getSolanaContext and certificateLoader.loadCertificate with correct args", async () => {
    // arrange
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    mockDataSource.getSolanaContext.mockResolvedValue(
      Right({
        descriptor: Buffer.from("d"),
        tokenAccount: "tkn",
        owner: "own",
        contract: "ctr",
      }),
    );

    // act
    await loader.load(context);

    // assert
    expect(mockCertLoader.loadCertificate).toHaveBeenCalledWith({
      keyId: "domain_metadata_key",
      keyUsage: KeyUsage.TxSimulationSigner,
      targetDevice: context.deviceModelId,
    });
    expect(mockDataSource.getSolanaContext).toHaveBeenCalledWith(context);
  });

  it("should return Left if certificate loader returns undefined", async () => {
    mockCertLoader.loadCertificate.mockResolvedValue(undefined);

    const result = await loader.load(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - DefaultSolanaContextLoader: CAL certificate is undefined",
        ),
      ),
    );
  });

  it("should propagate Left from dataSource.getSolanaContext", async () => {
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);
    const dsError = new Error("DS failure");
    mockDataSource.getSolanaContext.mockResolvedValue(Left(dsError));

    const result = await loader.load(context);

    expect(result).toEqual(Left(dsError));
  });

  it("should return Right with merged data and certificate on success", async () => {
    mockCertLoader.loadCertificate.mockResolvedValue(fakeCert);

    // DataSource only returns the four fields
    const dsPayload: SolanaTransactionContextResultSuccess = {
      descriptor: Buffer.from("dd"),
      tokenAccount: "tokenAcct",
      owner: "ownerAddr",
      contract: "contractAddr",
      certificate: fakeCert,
    };
    mockDataSource.getSolanaContext.mockResolvedValue(Right(dsPayload));

    const result = await loader.load(context);

    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      ...dsPayload,
      certificate: fakeCert,
    });
  });
});
