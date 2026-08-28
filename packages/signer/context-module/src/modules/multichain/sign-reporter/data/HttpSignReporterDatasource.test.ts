import {
  type DmkNetworkClient,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { BlindSignReason } from "@/modules/multichain/reporter/model/BlindSigningEvent";
import {
  type EthSignReportParams,
  type SolSignReportParams,
} from "@/modules/multichain/sign-reporter/model/SignReportParams";
import { BlindSigningModelId } from "@/shared/model/BlindSigningModelId";

import { HttpSignReporterDatasource } from "./HttpSignReporterDatasource";

describe("HttpSignReporterDatasource", () => {
  const config = {
    reporter: { url: "https://reporter.test" },
    appSource: "third-party",
    originToken: "originToken",
  } as ContextModuleServiceConfig;

  const envFields = {
    modelId: BlindSigningModelId.NANO_X,
    signerAppVersion: "1.4.0",
    deviceVersion: "2.2.3",
  };

  const solParams: SolSignReportParams = {
    ...envFields,
    chain: "SOL",
    signatureId: "abc123-1738850400000",
    signingMethod: "sol_signTransaction",
    isBlindSign: true,
    targetAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    blindSignReason: BlindSignReason.UNRECOGNIZED_PROGRAM,
    programIds: [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ],
    unrecognizedPrograms: ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
  };

  const ethParams: EthSignReportParams = {
    ...envFields,
    chain: "ETH",
    signatureId: "def456-1738850400000",
    signingMethod: "eth_signTransaction",
    isBlindSign: false,
    chainId: 1,
    targetAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    blindSignReason: null,
  };

  let httpMock: { post: ReturnType<typeof vi.fn> };
  let dataSource: HttpSignReporterDatasource;

  beforeEach(() => {
    vi.resetAllMocks();
    httpMock = { post: vi.fn() };
    dataSource = new HttpSignReporterDatasource(
      config,
      () =>
        ({
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        }) as unknown as LoggerPublisherService,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("report", () => {
    it("should return Right(undefined) on success", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);

      // WHEN
      const result = await dataSource.report(solParams);

      // THEN
      expect(result).toEqual(Right(undefined));
    });

    it("should return Left(Error) when the request fails", async () => {
      // GIVEN
      httpMock.post.mockRejectedValueOnce(new Error("network error"));

      // WHEN
      const result = await dataSource.report(solParams);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSignReporterDatasource: Failed to report signing event",
          ),
        ),
      );
    });

    it("should call the v2 endpoint with the correct URL", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);

      // WHEN
      await dataSource.report(solParams);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        `${config.reporter.url}/v2/blind-signing-events`,
        expect.anything(),
        { responseType: "void" },
      );
    });

    it("should build correct three-layer body for SOL params", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);

      // WHEN
      await dataSource.report(solParams);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          chain: "SOL",
          isBlindSign: true,
          sessionId: null,
          chainData: {
            chain: "SOL",
            signatureId: solParams.signatureId,
            signingMethod: "sol_signTransaction",
            targetAddress: solParams.targetAddress,
            blindSignReason: BlindSignReason.UNRECOGNIZED_PROGRAM,
            programIds: solParams.programIds,
            unrecognizedPrograms: solParams.unrecognizedPrograms,
          },
          envData: {
            modelId: BlindSigningModelId.NANO_X,
            signerAppVersion: "1.4.0",
            deviceVersion: "2.2.3",
            source: "third-party",
          },
        },
        { responseType: "void" },
      );
    });

    it("should build correct three-layer body for ETH params", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);

      // WHEN
      await dataSource.report(ethParams);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          chain: "ETH",
          isBlindSign: false,
          sessionId: null,
          chainData: {
            chain: "ETH",
            signatureId: ethParams.signatureId,
            signingMethod: "eth_signTransaction",
            targetAddress: ethParams.targetAddress,
            chainId: 1,
            blindSignReason: null,
          },
          envData: {
            modelId: BlindSigningModelId.NANO_X,
            signerAppVersion: "1.4.0",
            deviceVersion: "2.2.3",
            source: "third-party",
          },
        },
        { responseType: "void" },
      );
    });

    it("should include optional env fields when provided", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);
      const paramsWithOptional: SolSignReportParams = {
        ...solParams,
        platform: "desktop",
        appVersion: "2.80.0",
        platformOS: "macOS",
        platformVersion: "14.5",
        liveAppContext: "swap",
        sessionId: "session-abc",
      };

      // WHEN
      await dataSource.report(paramsWithOptional);

      // THEN
      const body = httpMock.post.mock.calls[0]![1];
      expect(body.envData.platform).toBe("desktop");
      expect(body.envData.appVersion).toBe("2.80.0");
      expect(body.envData.platformOS).toBe("macOS");
      expect(body.envData.platformVersion).toBe("14.5");
      expect(body.envData.liveAppContext).toBe("swap");
      expect(body.sessionId).toBe("session-abc");
    });

    it("should include transactionSignature in SOL chainData when provided", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);
      const paramsWithSig: SolSignReportParams = {
        ...solParams,
        transactionSignature: "5yJ9...",
      };

      // WHEN
      await dataSource.report(paramsWithSig);

      // THEN
      const body = httpMock.post.mock.calls[0]![1];
      expect(body.chainData.transactionSignature).toBe("5yJ9...");
    });
  });
});
