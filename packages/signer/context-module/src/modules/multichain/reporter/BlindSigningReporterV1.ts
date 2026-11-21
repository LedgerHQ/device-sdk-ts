// Deprecated v1 blind signing reporter API, kept as no-ops so integrators still compile. Remove in the next major.
import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { type Either, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type BlindSignReason } from "@/modules/multichain/sign-reporter/model/BlindSignReason";
import { type BlindSigningModelId } from "@/shared/model/BlindSigningModelId";

/** @deprecated Only used by the deprecated v1 blind signing reporter. */
export const BlindSigningMethod = Object.freeze({
  ETH_SIGN_TRANSACTION: "eth_signTransaction",
  ETH_SIGN_TYPED_DATA: "eth_signTypedData",
} as const);
/** @deprecated Only used by the deprecated v1 blind signing reporter. */
export type BlindSigningMethod =
  (typeof BlindSigningMethod)[keyof typeof BlindSigningMethod];

/** @deprecated Only used by the deprecated v1 blind signing reporter. */
export const ClearSigningType = Object.freeze({
  BASIC: "basic",
  EIP7730: "eip7730",
} as const);
/** @deprecated Only used by the deprecated v1 blind signing reporter. */
export type ClearSigningType =
  (typeof ClearSigningType)[keyof typeof ClearSigningType];

/** @deprecated Only used by the deprecated v1 blind signing reporter. */
export const BlindSigningPlatform = Object.freeze({
  DESKTOP: "desktop",
  MOBILE: "mobile",
} as const);
/** @deprecated Only used by the deprecated v1 blind signing reporter. */
export type BlindSigningPlatform =
  (typeof BlindSigningPlatform)[keyof typeof BlindSigningPlatform];

/** @deprecated Only used by the deprecated v1 blind signing reporter. */
export type BlindSigningReportEthContext = {
  clearSigningType: ClearSigningType;
  partialContextErrors: number;
};

/** @deprecated v1 blind signing report, no longer sent. Use SignReportParams instead. */
export type BlindSigningReportParams = {
  signatureId: string;
  signingMethod: BlindSigningMethod;
  isBlindSign: boolean;
  chainId: number | null;
  targetAddress: string | null;
  blindSignReason: BlindSignReason | null;
  modelId: BlindSigningModelId;
  signerAppVersion: string;
  deviceVersion: string | null;
  ethContext: BlindSigningReportEthContext | null;
  platform?: BlindSigningPlatform;
  appVersion?: string;
  platformOS?: string;
  platformVersion?: string;
  liveAppContext?: string | null;
  sessionId?: string | null;
};

/** @deprecated v1 blind signing reporter, no longer used. Use SignReporterDatasource instead. */
export interface BlindSigningReporterDatasource {
  report(params: BlindSigningReportParams): Promise<Either<Error, void>>;
}

/** @deprecated v1 blind signing reporter, no longer used. Use SignReporter instead. */
export interface BlindSigningReporter {
  report(params: BlindSigningReportParams): Promise<Either<Error, void>>;
}

/** @deprecated Sends nothing. Use HttpSignReporterDatasource instead. */
export class HttpBlindSigningReporterDatasource
  implements BlindSigningReporterDatasource
{
  constructor(
    _config: ContextModuleServiceConfig,
    _networkClient?: DmkNetworkClient,
  ) {}

  report(_params: BlindSigningReportParams): Promise<Either<Error, void>> {
    return Promise.resolve(Right(undefined));
  }
}

/** @deprecated Sends nothing. Use DefaultSignReporter instead. */
export class DefaultBlindSigningReporter implements BlindSigningReporter {
  constructor(private readonly dataSource: BlindSigningReporterDatasource) {}

  report(params: BlindSigningReportParams): Promise<Either<Error, void>> {
    return this.dataSource.report(params);
  }
}
