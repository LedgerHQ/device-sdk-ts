import { type Either } from "purify-ts";

import {
  type BlindSigningMethod,
  type BlindSigningPlatform,
  type BlindSignReason,
  type ClearSigningType,
} from "@/modules/multichain/reporter/model/BlindSigningEvent";
import { type BlindSigningModelId } from "@/modules/multichain/reporter/model/BlindSigningModelId";

export type BlindSigningReportEthContext = {
  clearSigningType: ClearSigningType;
  partialContextErrors: number;
};

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

export interface BlindSigningReporterDatasource {
  report(params: BlindSigningReportParams): Promise<Either<Error, void>>;
}
