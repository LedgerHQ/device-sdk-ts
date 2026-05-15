import type { PkiCertificate } from "@/pki/model/PkiCertificate";

export enum AleoContextTypes {
  ALEO_TOKEN = "aleoToken",
  ERROR = "error",
}

export type AleoTokenData = {
  aleoTokenDescriptor: {
    data: string;
    signature: string;
  };
};

export type AleoContextError = {
  type: AleoContextTypes.ERROR;
  error: Error;
};

export type AleoTokenContextSuccess = {
  type: AleoContextTypes.ALEO_TOKEN;
  payload: AleoTokenData;
  certificate?: PkiCertificate;
};

export type AleoTokenContextResult = AleoTokenContextSuccess | AleoContextError;

export type AleoTransactionContextResult = {
  loadersResults: AleoTokenContextResult[];
};
