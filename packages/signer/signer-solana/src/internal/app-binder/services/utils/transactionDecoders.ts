import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  decodeBurnCheckedInstruction,
  decodeBurnInstruction,
  decodeCloseAccountInstruction,
  decodeFreezeAccountInstruction,
  decodeInitializeAccount2Instruction,
  decodeInitializeAccount3Instruction,
  decodeInitializeAccountInstruction,
  decodeInitializeImmutableOwnerInstruction,
  decodeSyncNativeInstruction,
  decodeThawAccountInstruction,
  decodeTransferCheckedInstruction,
  decodeTransferCheckedWithFeeInstruction,
  decodeTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { type PublicKey, type TransactionInstruction } from "@solana/web3.js";

import {
  type NormalizedCompiledIx,
  type NormalizedMessage,
  type SolanaTransactionTypes,
} from "@internal/app-binder/services/TransactionInspector";

export interface TxInspectorResult {
  transactionType: SolanaTransactionTypes;
  data: {
    tokenAddress?: string;
    mintAddress?: string;
    createATA?: { address: string; mintAddress: string };
  };
}

export type IxContext = {
  programId: PublicKey;
  ixMeta: NormalizedCompiledIx;
  message: NormalizedMessage;
  instruction: TransactionInstruction;
};

export type Decoder = {
  when: (ctx: IxContext) => boolean;
  decode: (ctx: IxContext) => TxInspectorResult["data"] | null;
};

const isTokenProgramId = (pid: PublicKey) =>
  pid.equals(TOKEN_PROGRAM_ID) || pid.equals(TOKEN_2022_PROGRAM_ID);

const safe = <T>(fn: () => T): T | null => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export const DECODERS: Decoder[] = [
  // ATA creation (with derivation fallback)
  {
    when: ({ programId }) => programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID),
    decode: ({ ixMeta, message }) => {
      // Helpers to read by ix index safely
      const byIdx = (n: number): PublicKey | null => {
        const i = ixMeta.accountKeyIndexes[n];
        return i !== undefined ? (message.allKeys[i] ?? null) : null;
      };

      // Common positions (fast path)
      const ataPk = byIdx(1);
      let ownerPk = byIdx(2);
      let mintPk = byIdx(3);

      // Recover owner/mint if they weren't in the usual slots
      if (!ownerPk || !mintPk) {
        const afterFirstTwo = ixMeta.accountKeyIndexes.slice(2);
        for (const k of afterFirstTwo) {
          const pk = message.allKeys[k];
          if (!pk) continue;
          if (!ownerPk && pk !== ataPk) {
            ownerPk = pk;
            continue;
          }
          if (!mintPk && pk !== ataPk && pk !== ownerPk) {
            mintPk = pk;
          }
          if (ownerPk && mintPk) break;
        }
      }

      // Find token program by VALUE anywhere (works for legacy or 2022)
      let tokenProgramPk: PublicKey | null = null;
      for (const k of ixMeta.accountKeyIndexes) {
        const pk = message.allKeys[k];
        if (!pk) continue;
        if (pk.equals(TOKEN_PROGRAM_ID) || pk.equals(TOKEN_2022_PROGRAM_ID)) {
          tokenProgramPk = pk;
          break;
        }
      }

      // Need owner+mint at minimum
      if (!ownerPk || !mintPk) return null;

      // If ATA pubkey was provided in the ix, trust it
      if (ataPk) {
        return {
          createATA: {
            address: ataPk.toBase58(),
            mintAddress: mintPk.toBase58(),
          },
        };
      }

      // If token program is present, derive deterministically
      if (tokenProgramPk) {
        const isV22 = tokenProgramPk.equals(TOKEN_2022_PROGRAM_ID);
        const derived = getAssociatedTokenAddressSync(
          mintPk,
          ownerPk,
          true, // allowOwnerOffCurve
          isV22 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        return {
          createATA: {
            address: derived.toBase58(),
            mintAddress: mintPk.toBase58(),
          },
        };
      }

      // No ATA + no token program → let outer logic decide (Token-2022 hint / ALT fetch / conservative)
      return null;
    },
  },

  // Token-2022 fee’d transfer (CWIF)
  {
    when: ({ programId }) => programId.equals(TOKEN_2022_PROGRAM_ID),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { destination, mint },
        } = decodeTransferCheckedWithFeeInstruction(instruction, programId);
        return {
          tokenAddress: destination.pubkey.toBase58(),
          mintAddress: mint.pubkey.toBase58(),
        };
      }),
  },

  // Transfers
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { destination },
        } = decodeTransferInstruction(instruction, programId);
        return { tokenAddress: destination.pubkey.toBase58() };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { destination, mint },
        } = decodeTransferCheckedInstruction(instruction, programId);
        return {
          tokenAddress: destination.pubkey.toBase58(),
          mintAddress: mint.pubkey.toBase58(),
        };
      }),
  },

  // Account init
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account, mint },
        } = decodeInitializeAccountInstruction(instruction, programId);
        return {
          createATA: {
            address: account.pubkey.toBase58(),
            mintAddress: mint.pubkey.toBase58(),
          },
        };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account, mint },
        } = decodeInitializeAccount2Instruction(instruction, programId);
        return {
          createATA: {
            address: account.pubkey.toBase58(),
            mintAddress: mint.pubkey.toBase58(),
          },
        };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account, mint },
        } = decodeInitializeAccount3Instruction(instruction, programId);
        return {
          createATA: {
            address: account.pubkey.toBase58(),
            mintAddress: mint.pubkey.toBase58(),
          },
        };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account },
        } = decodeInitializeImmutableOwnerInstruction(instruction, programId);
        return { tokenAddress: account.pubkey.toBase58() };
      }),
  },

  // Lifecycle / WSOL
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account },
        } = decodeCloseAccountInstruction(instruction, programId);
        return { tokenAddress: account.pubkey.toBase58() };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account },
        } = decodeSyncNativeInstruction(instruction, programId);
        return { tokenAddress: account.pubkey.toBase58() };
      }),
  },

  // Mint / Burn
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account, mint },
        } = decodeBurnCheckedInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
          mintAddress: mint.pubkey.toBase58(),
        };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account, mint },
        } = decodeBurnInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
          mintAddress: mint.pubkey.toBase58(),
        };
      }),
  },

  // Freeze / Thaw
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account, mint },
        } = decodeFreezeAccountInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
          mintAddress: mint.pubkey.toBase58(),
        };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account, mint },
        } = decodeThawAccountInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
          mintAddress: mint.pubkey.toBase58(),
        };
      }),
  },

  // LAST-RESORT: tag as SPL by program id only (when decoders can't run)
  {
    when: ({ programId }) =>
      programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
      programId.equals(TOKEN_PROGRAM_ID) ||
      programId.equals(TOKEN_2022_PROGRAM_ID),
    decode: () => ({}),
  },
];
