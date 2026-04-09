import { type ValidatedSolanaTransactionCheckInput } from "@/transaction-check/input-validation/validateSolanaTransactionCheckInput";

import {
  type ScanHandlerResult,
  type Web3ChecksScanRequestBody,
} from "./transactionCheckScanTypes";
import { WEB3CHECKS_SOLANA_TX_SCAN_PATH } from "./web3CheckScanPaths";

export function solanaTransactionCheckScanHandler(
  validated: ValidatedSolanaTransactionCheckInput,
): ScanHandlerResult {
  const body: Web3ChecksScanRequestBody = {
    tx: {
      from: validated.from,
      raw: validated.rawTx,
    },
  };
  if (validated.chain !== undefined) {
    body.chain = validated.chain;
  }
  if (validated.domain !== undefined) {
    body.domain = validated.domain;
  }
  if (validated.block !== undefined) {
    body.block = validated.block;
  }
  return { path: WEB3CHECKS_SOLANA_TX_SCAN_PATH, body };
}
