import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, type PublicKey } from "@solana/web3.js";

import { RpcAddressLookupTableResolver } from "@internal/app-binder/services/utils/AddressLookupTableResolver";
import { TransactionParser } from "@internal/app-binder/services/utils/TransactionParser";

export enum SolanaTransactionTypes {
  STANDARD = "Standard",
  SPL = "SPL",
  SWAP = "Swap",
}

export type NormalizedCompiledIx = {
  programIdIndex: number;
  accountKeyIndexes: number[];
  data: Uint8Array;
};

export type NormalizedMessage = {
  compiledInstructions: NormalizedCompiledIx[];
  allKeys: PublicKey[];
};

export type TxInspectorResult = {
  transactionType: SolanaTransactionTypes;
  data: {
    tokenAddress?: string;
    createATA?: { address: string; mintAddress: string };
  };
};

const SPL_PROGRAM_IDS = new Set([
  TOKEN_PROGRAM_ID.toBase58(),
  TOKEN_2022_PROGRAM_ID.toBase58(),
  ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
]);

const isSPLProgram = (pk: PublicKey) => SPL_PROGRAM_IDS.has(pk.toBase58());

// SPL instruction discriminators (@solana/spl-token TokenInstruction enum)
const DISC = {
  INITIALIZE_ACCOUNT: 1,
  TRANSFER: 3,
  BURN: 8,
  CLOSE_ACCOUNT: 9,
  FREEZE_ACCOUNT: 10,
  THAW_ACCOUNT: 11,
  TRANSFER_CHECKED: 12,
  BURN_CHECKED: 15,
  INITIALIZE_ACCOUNT_2: 16,
  SYNC_NATIVE: 17,
  INITIALIZE_ACCOUNT_3: 18,
  INITIALIZE_IMMUTABLE_OWNER: 22,
  TRANSFER_FEE_EXTENSION: 26,
} as const;

// Token-2022 TransferCheckedWithFee sub-instruction within the fee extension.
const SUB_TRANSFER_CHECKED_WITH_FEE = 1;

const toTokenAddr = (
  pk: PublicKey | undefined,
): TxInspectorResult["data"] | null =>
  pk ? { tokenAddress: pk.toBase58() } : null;

const toCreateATA = (
  account: PublicKey | undefined,
  mint: PublicKey | undefined,
): TxInspectorResult["data"] | null =>
  account && mint
    ? {
        createATA: {
          address: account.toBase58(),
          mintAddress: mint.toBase58(),
        },
      }
    : null;

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com/";

/**
 * Determines whether a raw Solana transaction is an SPL token operation
 * and, if so, extracts the token account address or ATA creation details
 * needed for context.
 *
 * Internally:
 * 1. Deserialises the raw bytes via {@link TransactionParser} (handles
 *    both legacy and versioned v0 transactions, including ALT resolution).
 * 2. Classifies the normalised message by scanning instruction program IDs
 *    and extracting data via discriminator-based lookup
 */
export class TransactionInspector {
  private readonly parser: TransactionParser;

  constructor(rpcUrl?: string) {
    const connection = new Connection(rpcUrl ?? DEFAULT_RPC_URL, {
      commitment: "confirmed",
    });
    const resolver = new RpcAddressLookupTableResolver(connection);
    this.parser = new TransactionParser(resolver);
  }

  public async inspectTransactionType(
    rawTransactionBytes: Uint8Array,
    tokenAddress?: string | undefined,
    createATA?:
      | {
          address: string;
          mintAddress: string;
        }
      | undefined,
    templateId?: string | undefined,
  ): Promise<TxInspectorResult> {
    if (templateId) {
      return { transactionType: SolanaTransactionTypes.SWAP, data: {} };
    }

    try {
      const { message } = await this.parser.parse(rawTransactionBytes);
      return classify(message, tokenAddress, createATA);
    } catch {
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    }
  }
}

/** @internal — exported for unit testing. */
export function classify(
  message: NormalizedMessage,
  tokenAddress?: string,
  createATA?: { address: string; mintAddress: string },
): TxInspectorResult {
  // Fast path: caller already provides the resolution context
  if (tokenAddress || createATA) {
    const looksSPL = message.compiledInstructions.some((ix) => {
      const pid = message.allKeys[ix.programIdIndex];
      return pid ? isSPLProgram(pid) : false;
    });

    return {
      transactionType: looksSPL
        ? SolanaTransactionTypes.SPL
        : SolanaTransactionTypes.STANDARD,
      data: {
        ...(tokenAddress ? { tokenAddress } : {}),
        ...(createATA ? { createATA } : {}),
      },
    };
  }

  // Full scan: inspect every instruction
  let sawSPL = false;
  let best: TxInspectorResult["data"] = {};

  for (const ix of message.compiledInstructions) {
    const programId = message.allKeys[ix.programIdIndex];
    if (!programId) continue;
    if (isSPLProgram(programId)) sawSPL = true;

    const key = (localIdx: number): PublicKey | undefined => {
      const globalIdx = ix.accountKeyIndexes[localIdx];
      return globalIdx !== undefined ? message.allKeys[globalIdx] : undefined;
    };

    const data = extractSPLData(programId, key, ix.data);
    if (!data) continue;

    // createATA wins over tokenAddress, first match of each kind wins
    if (data.createATA && !best.createATA) {
      best = { ...best, createATA: data.createATA };
    } else if (data.tokenAddress && !best.tokenAddress && !best.createATA) {
      best = { ...best, tokenAddress: data.tokenAddress };
    }
  }

  if (best.createATA || best.tokenAddress) {
    return { transactionType: SolanaTransactionTypes.SPL, data: best };
  }
  if (sawSPL) {
    return { transactionType: SolanaTransactionTypes.SPL, data: {} };
  }
  return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
}

/**
 * Validate an ATA-creation instruction by deriving the expected ATA
 * from the candidate owner and mint, then checking it matches the
 * actual ATA account in the instruction.  This guards against
 * non-canonical account layouts or wrapper programs that re-order keys.
 *
 * Returns `createATA` data when validation succeeds, or `null` when the
 * derivation does not match (the tx is still tagged SPL, just without
 * potentially incorrect context).
 * @internal — exported for unit testing.
 */
export function extractValidatedATA(
  key: (idx: number) => PublicKey | undefined,
): TxInspectorResult["data"] | null {
  const ata = key(1);
  const owner = key(2);
  const mint = key(3);
  if (!ata || !owner || !mint) return null;

  // Derive with both token programs — the instruction may reference either.
  try {
    const derivedClassic = getAssociatedTokenAddressSync(
      mint,
      owner,
      true, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    if (derivedClassic.equals(ata)) {
      return toCreateATA(owner, mint);
    }
  } catch {
    /* derivation can throw for invalid inputs — try next */
  }

  try {
    const derived2022 = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    if (derived2022.equals(ata)) {
      return toCreateATA(owner, mint);
    }
  } catch {
    /* derivation failed — fall through */
  }

  // Could not confirm ATA derivation; return null to avoid emitting wrong data.
  return null;
}

/**
 * Discriminator-based SPL data extraction
 *
 * Each SPL Token instruction starts with a one-byte discriminator that
 * uniquely identifies the instruction type.  The account layout for each
 * type is fixed and documented in the SPL Token spec, so we simply read
 * the account at the known position.
 * @internal — exported for unit testing.
 */
export function extractSPLData(
  programId: PublicKey,
  key: (idx: number) => PublicKey | undefined,
  data: Uint8Array,
): TxInspectorResult["data"] | null {
  // Associated Token Program (ATA creation)
  // Accounts: [payer, ata, owner, mint, system, tokenProgram, rent?]
  if (programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
    return extractValidatedATA(key);
  }

  // Token Program / Token-2022 instructions
  if (
    !programId.equals(TOKEN_PROGRAM_ID) &&
    !programId.equals(TOKEN_2022_PROGRAM_ID)
  ) {
    return null;
  }

  if (data.length === 0) return null;

  switch (data[0]) {
    // Transfer: [source, destination, owner]
    case DISC.TRANSFER:
      return toTokenAddr(key(1));

    // TransferChecked: [source, mint, destination, owner]
    case DISC.TRANSFER_CHECKED:
      return toTokenAddr(key(2));

    // InitializeAccount (1/2/3): [account, mint, ...]
    case DISC.INITIALIZE_ACCOUNT:
    case DISC.INITIALIZE_ACCOUNT_2:
    case DISC.INITIALIZE_ACCOUNT_3:
      return toCreateATA(key(0), key(1));

    // Single-account instructions, the relevant account is always keys[0]
    case DISC.CLOSE_ACCOUNT: // [account, destination, authority]
    case DISC.SYNC_NATIVE: // [account]
    case DISC.BURN: // [account, mint, authority]
    case DISC.BURN_CHECKED: // [account, mint, authority]
    case DISC.FREEZE_ACCOUNT: // [account, mint, authority]
    case DISC.THAW_ACCOUNT: // [account, mint, authority]
    case DISC.INITIALIZE_IMMUTABLE_OWNER: // [account]
      return toTokenAddr(key(0));

    // Token-2022 extension: TransferCheckedWithFee
    // Data: [26, sub_instruction, ...]; accounts same as TransferChecked
    case DISC.TRANSFER_FEE_EXTENSION:
      if (data.length > 1 && data[1] === SUB_TRANSFER_CHECKED_WITH_FEE) {
        return toTokenAddr(key(2));
      }
      return null;

    default:
      return null;
  }
}
