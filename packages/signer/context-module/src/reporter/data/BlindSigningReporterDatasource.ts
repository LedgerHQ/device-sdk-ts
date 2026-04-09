import { type Either } from "purify-ts";

import {
  type BlindSigningMethod,
  type BlindSignReason,
  type ClearSigningType,
} from "@/reporter/model/BlindSigningEvent";
import { type BlindSigningModelId } from "@/reporter/model/BlindSigningModelId";

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
};

export interface BlindSigningReporterDatasource {
  report(params: BlindSigningReportParams): Promise<Either<Error, void>>;
}
