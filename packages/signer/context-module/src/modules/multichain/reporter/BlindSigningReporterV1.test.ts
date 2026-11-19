import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import {
  type BlindSigningReportParams,
  DefaultBlindSigningReporter,
  HttpBlindSigningReporterDatasource,
} from "./BlindSigningReporterV1";

describe("BlindSigningReporterV1 (deprecated)", () => {
  const config = {} as ContextModuleServiceConfig;
  const params = {} as BlindSigningReportParams;

  it("should not send anything from HttpBlindSigningReporterDatasource", async () => {
    const post = vi.fn();
    const datasource = new HttpBlindSigningReporterDatasource(config, {
      post,
    } as unknown as DmkNetworkClient);

    expect(await datasource.report(params)).toEqual(Right(undefined));
    expect(post).not.toHaveBeenCalled();
  });

  it("should not send anything from DefaultBlindSigningReporter", async () => {
    const dataSource = { report: vi.fn() };
    const reporter = new DefaultBlindSigningReporter(dataSource);

    expect(await reporter.report(params)).toEqual(Right(undefined));
    expect(dataSource.report).not.toHaveBeenCalled();
  });
});
