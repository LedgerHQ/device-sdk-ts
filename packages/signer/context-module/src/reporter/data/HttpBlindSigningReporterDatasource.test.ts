import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type BlindSigningReportParams } from "@/reporter/data/BlindSigningReporterDatasource";
import { HttpBlindSigningReporterDatasource } from "@/reporter/data/HttpBlindSigningReporterDatasource";
import {
  BlindSigningMethod,
  BlindSigningPlatform,
  BlindSignReason,
  ClearSigningType,
} from "@/reporter/model/BlindSigningEvent";
import { BlindSigningModelId } from "@/reporter/model/BlindSigningModelId";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

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

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("report", () => {
    it("should return Right(undefined) on success", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 200 }),
      );

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      const result = await dataSource.report(params);

      // THEN
      expect(result).toEqual(Right(undefined));
    });

    it("should return Left(Error) when the request fails", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("network error"),
      );

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
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

    it("should call fetch with the correct URL and method", async () => {
      // GIVEN
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      await dataSource.report(params);

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        `${config.reporter!.url}/blind-signing-events`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should call fetch with the correct headers", async () => {
      // GIVEN
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      await dataSource.report(params);

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          }),
        }),
      );
    });

    it("should call fetch with the event payload and injected source as body", async () => {
      // GIVEN
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      await dataSource.report(params);

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ ...params, source: config.appSource }),
        }),
      );
    });

    it("should forward optional DTO fields when provided", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });
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
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      await dataSource.report(paramsWithOptionalFields);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ...paramsWithOptionalFields, source: config.appSource },
        }),
      );
    });
  });
});
