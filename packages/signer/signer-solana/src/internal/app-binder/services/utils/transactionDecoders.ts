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
import {
  type PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  type TransactionInstruction,
} from "@solana/web3.js";

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

export type CreateAtaExplanation = {
  ataFromIx: string;
  ownerFound?: string;
  mint: string;
  tokenProgramUsed: "token" | "token2022";
  derivedClassic?: string;
  derived2022?: string;
  matches: "classic" | "token2022" | "neither";
};

export const DECODERS: Decoder[] = [
  // ATA creation (with derivation fallback)

  {
    // NOTE: returns the OWNER in createATA.address (not the ATA PDA)
    when: ({ programId }) => programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID),
    decode: ({ ixMeta, message }) => {
      const idxs = ixMeta.accountKeyIndexes ?? [];
      const byIdx = (n: number) =>
        idxs[n] !== undefined ? (message.allKeys[idxs[n]] ?? null) : null;

      // Canonical ATA ix layout: [payer, ata, owner, mint, system, tokenProgram, rent?]
      const ataPk = byIdx(1);
      const mintPk = byIdx(3);
      if (!ataPk || !mintPk) return null;

      const accs = idxs
        .map((i) => message.allKeys[i])
        .filter((k): k is PublicKey => !!k);

      // Prefer token-2022 if present among ix accounts; else token classic.
      const tokenProgInIx =
        accs.find((pk) => pk.equals(TOKEN_2022_PROGRAM_ID)) ??
        accs.find((pk) => pk.equals(TOKEN_PROGRAM_ID)) ??
        null;

      const isProgramOrSysvar = (pk: PublicKey) =>
        pk.equals(SystemProgram.programId) ||
        pk.equals(TOKEN_PROGRAM_ID) ||
        pk.equals(TOKEN_2022_PROGRAM_ID) ||
        pk.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
        pk.equals(SYSVAR_RENT_PUBKEY);

      // Candidate owners: exclude programs/sysvars, the ATA itself, and the mint
      const ownerCandidates = accs.filter(
        (pk) =>
          !isProgramOrSysvar(pk) && !pk.equals(ataPk) && !pk.equals(mintPk),
      );

      const derive = (owner: PublicKey, tokenProg: PublicKey) =>
        getAssociatedTokenAddressSync(
          mintPk,
          owner,
          true, // allowOwnerOffCurve
          tokenProg,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );

      // 1) Try with the token program actually referenced in the ix (if any)
      if (tokenProgInIx) {
        for (const owner of ownerCandidates) {
          if (derive(owner, tokenProgInIx).equals(ataPk)) {
            return {
              createATA: {
                address: owner.toBase58(),
                mintAddress: mintPk.toBase58(),
              },
            };
          }
        }
      }

      // 2) Fallback: try both classic and 2022 (covers odd wrappers/missing program acct)
      for (const owner of ownerCandidates) {
        const dClassic = derive(owner, TOKEN_PROGRAM_ID);
        if (dClassic.equals(ataPk)) {
          return {
            createATA: {
              address: owner.toBase58(),
              mintAddress: mintPk.toBase58(),
            },
          };
        }
        const d22 = derive(owner, TOKEN_2022_PROGRAM_ID);
        if (d22.equals(ataPk)) {
          return {
            createATA: {
              address: owner.toBase58(),
              mintAddress: mintPk.toBase58(),
            },
          };
        }
      }

      // If we can't prove the owner by derivation, don't guess.
      return null;
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
