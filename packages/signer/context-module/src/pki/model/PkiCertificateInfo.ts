import type { KeyUsage } from "@/pki/model/KeyUsage";

import { type KeyId } from "./KeyId";

export type PkiCertificateInfo = {
  targetDevice: string;
  keyUsage: KeyUsage;
  keyId: KeyId;
};
