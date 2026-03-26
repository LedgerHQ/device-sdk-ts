import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ResolvedContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { type BlindSigningReportParams } from "@/reporter/data/BlindSigningReporterDatasource";
import { HttpBlindSigningReporterDatasource } from "@/reporter/data/HttpBlindSigningReporterDatasource";
import {
  BlindSigningMethod,
  BlindSignReason,
  ClearSigningType,
} from "@/reporter/model/BlindSigningEvent";
import { BlindSigningModelId } from "@/reporter/model/BlindSigningModelId";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

vi.mock("axios");

describe("HttpBlindSigningReporterDatasource", () => {
  const config = {
    reporter: {
      url: "https://reporter.test",
    },
    originToken: "originToken",
  } as ResolvedContextModuleConfig;

  const params: BlindSigningReportParams = {
    signatureId: "a3f8Kb-1738850400000",
    signingMethod: BlindSigningMethod.ETH_SIGN_TRANSACTION,
    source: "ledger_wallet",
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
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      const result = await dataSource.report(params);

      // THEN
      expect(result).toEqual(Right(undefined));
    });

    it("should return Left(Error) when the request fails", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValueOnce(
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

    it("should call axios with the correct URL and method", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      await dataSource.report(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: `${config.reporter!.url}/v1/blind-signing-events`,
        }),
      );
    });

    it("should call axios with the correct headers", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      await dataSource.report(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
        }),
      );
    });

    it("should call axios with the event payload as data", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      // WHEN
      const dataSource = new HttpBlindSigningReporterDatasource(config);
      await dataSource.report(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: params,
        }),
      );
    });
  });
});
