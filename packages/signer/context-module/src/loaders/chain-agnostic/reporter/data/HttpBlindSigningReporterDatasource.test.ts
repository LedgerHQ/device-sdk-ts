import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type BlindSigningReportParams } from "@/loaders/chain-agnostic/reporter/data/BlindSigningReporterDatasource";
import { HttpBlindSigningReporterDatasource } from "@/loaders/chain-agnostic/reporter/data/HttpBlindSigningReporterDatasource";
import {
  BlindSigningMethod,
  BlindSigningPlatform,
  BlindSignReason,
  ClearSigningType,
} from "@/loaders/chain-agnostic/reporter/model/BlindSigningEvent";
import { BlindSigningModelId } from "@/loaders/chain-agnostic/reporter/model/BlindSigningModelId";

describe("HttpBlindSigningReporterDatasource", () => {
  const config = {
    reporter: {
      url: "https://reporter.test",
    },
    originToken: "originToken",
    appSource: "third-party",
  } as ContextModuleServiceConfig;

  const params: BlindSigningReportParams = {
    signatureId: "a3f8Kb-1738850400000",
    signingMethod: BlindSigningMethod.ETH_SIGN_TRANSACTION,
    isBlindSign: true,
    chainId: 1,
    targetAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    blindSignReason: BlindSignReason.NO_CLEAR_SIGNING_CONTEXT,
    modelId: BlindSigningModelId.NANO_X,
    signerAppVersion: "1.12.1",
    deviceVersion: "2.2.3",
    ethContext: {
      clearSigningType: ClearSigningType.EIP7730,
      partialContextErrors: 0,
    },
  };

  let httpMock: { post: ReturnType<typeof vi.fn> };
  let dataSource: HttpBlindSigningReporterDatasource;

  beforeEach(() => {
    vi.resetAllMocks();
    httpMock = { post: vi.fn() };
    dataSource = new HttpBlindSigningReporterDatasource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("report", () => {
    it("should return Right(undefined) on success", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);

      // WHEN
      const result = await dataSource.report(params);

      // THEN
      expect(result).toEqual(Right(undefined));
    });

    it("should return Left(Error) when the request fails", async () => {
      // GIVEN
      httpMock.post.mockRejectedValueOnce(new Error("network error"));

      // WHEN
      const result = await dataSource.report(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpBlindSigningReporterDatasource: Failed to report blind signing event",
          ),
        ),
      );
    });

    it("should call http.post with the correct URL, body and options", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);

      // WHEN
      await dataSource.report(params);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        `${config.reporter!.url}/blind-signing-events`,
        { ...params, source: config.appSource },
        { responseType: "void" },
      );
    });

    it("should forward optional DTO fields when provided", async () => {
      // GIVEN
      httpMock.post.mockResolvedValueOnce(undefined);
      const paramsWithOptionalFields: BlindSigningReportParams = {
        ...params,
        platform: BlindSigningPlatform.DESKTOP,
        appVersion: "2.80.0",
        platformOS: "macOS",
        platformVersion: "14.5",
        liveAppContext: "swap",
        sessionId: "session-123",
      };

      // WHEN
      await dataSource.report(paramsWithOptionalFields);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        `${config.reporter!.url}/blind-signing-events`,
        { ...paramsWithOptionalFields, source: config.appSource },
        { responseType: "void" },
      );
    });
  });
});
