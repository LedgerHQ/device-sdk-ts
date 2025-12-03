import type { PkiCertificate } from "@/pki/model/PkiCertificate";

export enum SolanaContextTypes {
  SOLANA_TOKEN = "solanaToken",
  SOLANA_LIFI = "solanaLifi",
  ERROR = "error",
}

export type SolanaTransactionDescriptor = {
  data: string;
  descriptorType: string;
  descriptorVersion: string;
  signatures: {
    prod?: string;
    test?: string;
  };
};

export type SolanaTransactionDescriptorList = Record<
  string,
  SolanaTransactionDescriptor
>;

export type SolanaTokenData = {
  solanaTokenDescriptor: {
    data: string;
    signature: string;
  };
};

export type SolanaContextSuccessType = Exclude<
  SolanaContextTypes,
  SolanaContextTypes.ERROR
>;

// map from Solana success type to payload
type SolanaContextSuccessPayloads = {
  [SolanaContextTypes.SOLANA_TOKEN]: {
    payload: SolanaTokenData;
    certificate?: PkiCertificate;
  };
  [SolanaContextTypes.SOLANA_LIFI]: {
    payload: SolanaTransactionDescriptorList;
  };
};

export type SolanaContextSuccess<
  T extends SolanaContextSuccessType = SolanaContextSuccessType,
> = {
  type: T;
} & SolanaContextSuccessPayloads[T];

export type SolanaContextError = {
  type: SolanaContextTypes.ERROR;
  error: Error;
};

export type SolanaContext = SolanaContextSuccess | SolanaContextError;

export type SolanaTokenContextSuccess =
  SolanaContextSuccess<SolanaContextTypes.SOLANA_TOKEN>;

export type SolanaLifiContextSuccess =
  SolanaContextSuccess<SolanaContextTypes.SOLANA_LIFI>;

export type SolanaTokenContextResult =
  | SolanaTokenContextSuccess
  | SolanaContextError;

export type SolanaLifiContextResult =
  | SolanaLifiContextSuccess
  | SolanaContextError;

export type LoaderResult = SolanaTokenContextResult | SolanaLifiContextResult;
