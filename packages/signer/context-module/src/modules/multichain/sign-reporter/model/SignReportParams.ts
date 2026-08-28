import { type BlindSignReason } from "@/modules/multichain/reporter/model/BlindSigningEvent";
import { type BlindSigningModelId } from "@/shared/model/BlindSigningModelId";

export const SigningMethod = Object.freeze({
  ETH_SIGN_TRANSACTION: "eth_signTransaction",
  ETH_SIGN_TYPED_DATA: "eth_signTypedData",
  SOL_SIGN_TRANSACTION: "sol_signTransaction",
} as const);
export type SigningMethod = (typeof SigningMethod)[keyof typeof SigningMethod];

type SignReportEnvData = {
  modelId: BlindSigningModelId;
  signerAppVersion: string;
  deviceVersion: string | null;
  platform?: "desktop" | "mobile";
  appVersion?: string;
  platformOS?: string;
  platformVersion?: string;
  liveAppContext?: string | null;
  sessionId?: string | null;
};

export type EthSignReportParams = SignReportEnvData & {
  chain: "ETH";
  signatureId: string;
  signingMethod:
    | typeof SigningMethod.ETH_SIGN_TRANSACTION
    | typeof SigningMethod.ETH_SIGN_TYPED_DATA;
  isBlindSign: boolean;
  chainId: number | null;
  targetAddress: string | null;
  selectorId?: string | null;
  blindSignReason: BlindSignReason | null;
  clearSigningType?: "basic" | "eip7730" | null;
  partialContextErrors?: number | null;
};

export type SolSignReportParams = SignReportEnvData & {
  chain: "SOL";
  signatureId: string;
  signingMethod: typeof SigningMethod.SOL_SIGN_TRANSACTION;
  isBlindSign: boolean;
  targetAddress: string | null;
  blindSignReason: BlindSignReason | null;
  programIds: string[];
  unrecognizedPrograms: string[];
  transactionSignature?: string | null;
};

export type SignReportParams = EthSignReportParams | SolSignReportParams;
