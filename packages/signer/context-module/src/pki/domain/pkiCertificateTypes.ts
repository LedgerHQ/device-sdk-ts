import type { KeyUsage } from "./model/KeyUsage";

export type PkiCertificate = {
  keyUsageNumber: number;
  payload: Uint8Array;
};

export type PkiCertificateInfo = {
  targetDevice: string;
  keyUsage: KeyUsage;
  keyId?: string | undefined;
};

/*
Do we re add it to PkiCertificateInfo?
osVersion: string;
*/
