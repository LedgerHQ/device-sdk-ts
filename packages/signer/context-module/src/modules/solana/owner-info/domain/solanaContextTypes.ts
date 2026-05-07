import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type LoaderResult } from "@/shared/model/SolanaContextTypes";

export type {
  SolanaSPLOwnerInfo,
  SolanaTransactionContext,
} from "@/shared/model/SolanaTransactionContext";

export type SolanaTransactionContextResultSuccess = {
  trustedNamePKICertificate?: PkiCertificate;
  tlvDescriptor?: Uint8Array;
  loadersResults: LoaderResult[];
  contextErrorCount: number;
};
