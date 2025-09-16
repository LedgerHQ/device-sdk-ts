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
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { type PublicKey, type TransactionInstruction } from "@solana/web3.js";

import {
  type NormalizedCompiledIx,
  type NormalizedMessage,
  type TxInspectorResult,
} from "@internal/app-binder/services/TransactionInspector";

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
      const byIdx = (n: number): PublicKey | null => {
        const i = ixMeta.accountKeyIndexes[n];
        return i !== undefined ? (message.allKeys[i] ?? null) : null;
      };

      const ataPk = byIdx(1);
      const ownerPk = byIdx(2);
      const mintPk = byIdx(3);
      if (!ownerPk || !mintPk || !ataPk) return null;

      return {
        createATA: {
          address: ataPk.toBase58(),
          mintAddress: mintPk.toBase58(),
        },
      };
    },
  },

  // Token-2022 fee’d transfer (CWIF)
  {
    when: ({ programId }) => programId.equals(TOKEN_2022_PROGRAM_ID),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { destination },
        } = decodeTransferCheckedWithFeeInstruction(instruction, programId);
        return {
          tokenAddress: destination.pubkey.toBase58(),
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
          keys: { destination },
        } = decodeTransferCheckedInstruction(instruction, programId);
        return {
          tokenAddress: destination.pubkey.toBase58(),
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
          keys: { account },
        } = decodeBurnCheckedInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
        };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account },
        } = decodeBurnInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
        };
      }),
  },

  // Freeze / Thaw
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account },
        } = decodeFreezeAccountInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
        };
      }),
  },
  {
    when: ({ programId }) => isTokenProgramId(programId),
    decode: ({ instruction, programId }) =>
      safe(() => {
        const {
          keys: { account },
        } = decodeThawAccountInstruction(instruction, programId);
        return {
          tokenAddress: account.pubkey.toBase58(),
        };
      }),
  },

  // LAST-RESORT: tag as SPL by program id only (when decoders can't run)
  {
    when: ({ programId }) =>
      programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
      programId.equals(TOKEN_PROGRAM_ID) ||
      programId.equals(TOKEN_2022_PROGRAM_ID),
    decode: () => null,
  },
];
