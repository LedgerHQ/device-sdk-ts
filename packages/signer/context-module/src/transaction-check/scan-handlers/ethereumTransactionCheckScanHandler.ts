import { type ValidatedEthereumTransactionCheckInput } from "@/transaction-check/input-validation/validateEthereumTransactionCheckInput";

import {
  type ScanHandlerResult,
  type Web3ChecksScanRequestBody,
} from "./transactionCheckScanTypes";
import { WEB3CHECKS_ETHEREUM_TX_SCAN_PATH } from "./web3CheckScanPaths";

export function ethereumTransactionCheckScanHandler(
  validated: ValidatedEthereumTransactionCheckInput,
): ScanHandlerResult {
  const body: Web3ChecksScanRequestBody = {
    tx: {
      from: validated.from,
      raw: validated.rawTx,
    },
    chain: validated.chainId,
  };
  if (validated.domain !== undefined) {
    body.domain = validated.domain;
  }
  if (validated.block !== undefined) {
    body.block = validated.block;
  }
  return { path: WEB3CHECKS_ETHEREUM_TX_SCAN_PATH, body };
}
