import { Left, Right } from "purify-ts";

import { type BlindSigningReporterDatasource } from "@/reporter/data/BlindSigningReporterDatasource";
import {
  BlindSigningMethod,
  BlindSignReason,
  ClearSigningType,
} from "@/reporter/model/BlindSigningEvent";
import { BlindSigningModelId } from "@/reporter/model/BlindSigningModelId";

import { DefaultBlindSigningReporter } from "./DefaultBlindSigningReporter";

describe("DefaultBlindSigningReporter", () => {
  const params = {
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

  it("should delegate to the datasource and return Right on success", async () => {
    // GIVEN
    const dataSource: BlindSigningReporterDatasource = {
      report: vi.fn().mockResolvedValueOnce(Right(undefined)),
    };
    const reporter = new DefaultBlindSigningReporter(dataSource);

    // WHEN
    const result = await reporter.report(params);

    // THEN
    expect(dataSource.report).toHaveBeenCalledWith(params);
    expect(result).toEqual(Right(undefined));
  });

  it("should delegate to the datasource and return Left on failure", async () => {
    // GIVEN
    const error = new Error("report failed");
    const dataSource: BlindSigningReporterDatasource = {
      report: vi.fn().mockResolvedValueOnce(Left(error)),
    };
    const reporter = new DefaultBlindSigningReporter(dataSource);

    // WHEN
    const result = await reporter.report(params);

    // THEN
    expect(dataSource.report).toHaveBeenCalledWith(params);
    expect(result).toEqual(Left(error));
  });
});
