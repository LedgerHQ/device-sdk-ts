import { Left, Right } from "purify-ts";

import { BlindSignReason } from "@/modules/multichain/reporter/model/BlindSigningEvent";
import { type SignReporterDatasource } from "@/modules/multichain/sign-reporter/data/SignReporterDatasource";
import { type SolSignReportParams } from "@/modules/multichain/sign-reporter/model/SignReportParams";
import { BlindSigningModelId } from "@/shared/model/BlindSigningModelId";

import { DefaultSignReporter } from "./DefaultSignReporter";

describe("DefaultSignReporter", () => {
  const params: SolSignReportParams = {
    chain: "SOL",
    signatureId: "abc123-1738850400000",
    signingMethod: "sol_signTransaction",
    isBlindSign: true,
    targetAddress: null,
    blindSignReason: BlindSignReason.NO_CLEAR_SIGNING_CONTEXT,
    programIds: ["11111111111111111111111111111111"],
    unrecognizedPrograms: [],
    modelId: BlindSigningModelId.FLEX,
    signerAppVersion: "1.4.0",
    deviceVersion: "2.2.3",
  };

  it("should delegate to the datasource and return Right on success", async () => {
    // GIVEN
    const dataSource: SignReporterDatasource = {
      report: vi.fn().mockResolvedValueOnce(Right(undefined)),
    };
    const reporter = new DefaultSignReporter(dataSource);

    // WHEN
    const result = await reporter.report(params);

    // THEN
    expect(dataSource.report).toHaveBeenCalledWith(params);
    expect(result).toEqual(Right(undefined));
  });

  it("should delegate to the datasource and return Left on failure", async () => {
    // GIVEN
    const error = new Error("report failed");
    const dataSource: SignReporterDatasource = {
      report: vi.fn().mockResolvedValueOnce(Left(error)),
    };
    const reporter = new DefaultSignReporter(dataSource);

    // WHEN
    const result = await reporter.report(params);

    // THEN
    expect(dataSource.report).toHaveBeenCalledWith(params);
    expect(result).toEqual(Left(error));
  });
});
