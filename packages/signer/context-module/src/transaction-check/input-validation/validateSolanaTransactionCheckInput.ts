import bs58 from "bs58";
import type { Either } from "purify-ts";
import { Left, Right } from "purify-ts";

import { SolanaTransactionScanChainId } from "@/shared/model/Web3ChecksTypes";

const PREFIX = "[ContextModule] validateSolanaTransactionCheckInput";

/** Ed25519 public key length for Solana account keys. */
const SOLANA_PUBKEY_BYTE_LENGTH = 32;

const SOLANA_SCAN_CHAIN_IDS: ReadonlySet<SolanaTransactionScanChainId> =
  new Set([
    SolanaTransactionScanChainId.MAINNET,
    SolanaTransactionScanChainId.DEVNET,
    SolanaTransactionScanChainId.TESTNET,
  ]);

export type ValidatedSolanaTransactionCheckInput = {
  from: string;
  rawTx: string;
  chain: SolanaTransactionScanChainId | undefined;
  domain: string | undefined;
  block: number | undefined;
};

export function validateSolanaTransactionCheckInput(params: {
  from: string;
  rawTx: string;
  chain?: number;
  domain?: string;
  block?: number;
}): Either<Error, ValidatedSolanaTransactionCheckInput> {
  const fromTrimmed = params.from.trim();
  const rawTrimmed = params.rawTx.trim();

  let fromBytes: Uint8Array;
  try {
    fromBytes = bs58.decode(fromTrimmed);
  } catch {
    return Left(
      new Error(`${PREFIX}: Invalid base58 from (signer public key)`),
    );
  }
  if (fromBytes.length !== SOLANA_PUBKEY_BYTE_LENGTH) {
    return Left(
      new Error(
        `${PREFIX}: from must decode to ${SOLANA_PUBKEY_BYTE_LENGTH} bytes`,
      ),
    );
  }

  let rawBytes: Uint8Array;
  try {
    rawBytes = bs58.decode(rawTrimmed);
  } catch {
    return Left(
      new Error(`${PREFIX}: Invalid base58 raw (serialized message)`),
    );
  }
  if (rawBytes.length === 0) {
    return Left(new Error(`${PREFIX}: Raw serialized message is empty`));
  }

  let chain: SolanaTransactionScanChainId | undefined;
  if (params.chain !== undefined) {
    if (
      !SOLANA_SCAN_CHAIN_IDS.has(params.chain as SolanaTransactionScanChainId)
    ) {
      return Left(
        new Error(
          `${PREFIX}: chain must be 1 (mainnet-beta), 2 (devnet), or 3 (testnet)`,
        ),
      );
    }
    chain = params.chain as SolanaTransactionScanChainId;
  }

  const domain =
    params.domain !== undefined && params.domain.trim().length > 0
      ? params.domain.trim()
      : undefined;

  if (params.block !== undefined && !Number.isInteger(params.block)) {
    return Left(new Error(`${PREFIX}: block must be an integer when provided`));
  }
  const block = params.block;

  return Right({
    from: fromTrimmed,
    rawTx: rawTrimmed,
    chain,
    domain,
    block,
  });
}
