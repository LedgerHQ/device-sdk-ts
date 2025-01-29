import type { KeyUsage } from "@/pki/model/KeyUsage";

export type PkiCertificateInfo = {
  targetDevice: string;
  keyUsage: KeyUsage;
  keyId?: string | undefined;
};
