import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type LoaderResult } from "@/modules/solana/model/SolanaContextTypes";

export type {
  SolanaSPLOwnerInfo,
  SolanaTransactionContext,
} from "@/modules/solana/model/SolanaTransactionContext";

export type SolanaTransactionContextResultSuccess = {
  trustedNamePKICertificate?: PkiCertificate;
  tlvDescriptor?: Uint8Array;
  loadersResults: LoaderResult[];
  contextErrorCount: number;
};
