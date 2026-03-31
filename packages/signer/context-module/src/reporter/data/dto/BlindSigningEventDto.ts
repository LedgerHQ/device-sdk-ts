import {
  type BlindSigningMethod,
  type BlindSigningPlatform,
  type BlindSignReason,
  type ClearSigningType,
} from "@/reporter/model/BlindSigningEvent";
import { type BlindSigningModelId } from "@/reporter/model/BlindSigningModelId";

export type BlindSigningEventEthContextDto = {
  clearSigningType: ClearSigningType;
  partialContextErrors: number;
};

export type BlindSigningEventDto = {
  signatureId: string;
  signingMethod: BlindSigningMethod;
  source: string;
  isBlindSign: boolean;
  chainId: number | null;
  targetAddress: string | null;
  blindSignReason: BlindSignReason | null;
  modelId: BlindSigningModelId;
  signerAppVersion: string;
  deviceVersion: string | null;
  ethContext: BlindSigningEventEthContextDto | null;
  platform?: BlindSigningPlatform;
  appVersion?: string;
  platformOS?: string;
  platformVersion?: string;
  liveAppContext?: string | null;
  sessionId?: string | null;
};
