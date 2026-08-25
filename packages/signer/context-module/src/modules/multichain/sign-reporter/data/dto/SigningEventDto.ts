import { type BlindSignReason } from "@/modules/multichain/reporter/model/BlindSigningEvent";
import { type BlindSigningModelId } from "@/shared/model/BlindSigningModelId";

type SigningEventEnvDataDto = {
  modelId: BlindSigningModelId;
  signerAppVersion: string;
  deviceVersion: string | null;
  source: string;
  platform?: "desktop" | "mobile";
  appVersion?: string;
  platformOS?: string;
  platformVersion?: string;
  liveAppContext?: string | null;
};

type EthChainDataDto = {
  chain: "ETH";
  signatureId: string;
  signingMethod: "eth_signTransaction" | "eth_signTypedData";
  targetAddress: string | null;
  chainId: number | null;
  blindSignReason: BlindSignReason | null;
  selectorId?: string | null;
  clearSigningType?: "basic" | "eip7730" | null;
  partialContextErrors?: number | null;
};

type SolChainDataDto = {
  chain: "SOL";
  signatureId: string;
  signingMethod: "sol_signTransaction";
  targetAddress: string | null;
  blindSignReason: BlindSignReason | null;
  programIds: string[];
  unrecognizedPrograms: string[];
  transactionSignature?: string | null;
};

type SigningEventDtoBase = {
  isBlindSign: boolean;
  sessionId: string | null;
  envData: SigningEventEnvDataDto;
};

export type SigningEventDto =
  | (SigningEventDtoBase & { chain: "ETH"; chainData: EthChainDataDto })
  | (SigningEventDtoBase & { chain: "SOL"; chainData: SolChainDataDto });
