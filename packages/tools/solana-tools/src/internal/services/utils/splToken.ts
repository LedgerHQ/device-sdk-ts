import { sha256 } from "@noble/hashes/sha2";
import {
  type AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

// Inlined from `@solana/spl-token` to keep its unpatched transitive
// `bigint-buffer` advisory (CVE-2025-3194) out of the dependency graph.

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export function getAssociatedTokenAddressSync(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
  associatedTokenProgramId: PublicKey = ASSOCIATED_TOKEN_PROGRAM_ID,
): PublicKey {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBytes())) {
    throw new Error("TokenOwnerOffCurveError");
  }
  const [address] = findProgramAddressSync(
    [owner.toBytes(), tokenProgramId.toBytes(), mint.toBytes()],
    associatedTokenProgramId,
  );
  return address;
}

// ASCII bytes of the PDA marker, built without TextEncoder so this module adds
// no runtime global requirement of its own.
const PDA_MARKER = Uint8Array.from(
  "ProgramDerivedAddress",
  (char) => char.codePointAt(0) ?? 0,
);

// Synchronous PDA derivation. web3.js v3 only offers an async
// `PublicKey.findProgramAddress`, and making token-account derivation async
// would ripple through every caller.
export function findProgramAddressSync(
  seeds: Uint8Array[],
  programId: PublicKey,
): [PublicKey, number] {
  const programIdBytes = programId.toBytes();
  for (let bump = 255; bump >= 0; bump--) {
    const hasher = sha256.create();
    for (const seed of seeds) hasher.update(seed);
    const hash = hasher
      .update(new Uint8Array([bump]))
      .update(programIdBytes)
      .update(PDA_MARKER)
      .digest();
    if (!PublicKey.isOnCurve(hash)) {
      return [new PublicKey(hash), bump];
    }
  }
  throw new Error("Unable to find a viable program address bump seed");
}

type InstructionData = NonNullable<
  ConstructorParameters<typeof TransactionInstruction>[0]["data"]
>;

export const asInstructionData = (bytes: Uint8Array): InstructionData =>
  bytes as InstructionData;

// Mirrors `addSigners` from `@solana/spl-token`.
export function addSigners(
  keys: AccountMeta[],
  ownerOrAuthority: PublicKey,
  multiSigners: PublicKey[],
): AccountMeta[] {
  if (multiSigners.length) {
    keys.push({ pubkey: ownerOrAuthority, isSigner: false, isWritable: false });
    for (const signer of multiSigners) {
      keys.push({ pubkey: signer, isSigner: true, isWritable: false });
    }
  } else {
    keys.push({ pubkey: ownerOrAuthority, isSigner: true, isWritable: false });
  }
  return keys;
}

const TRANSFER_CHECKED_INSTRUCTION = 12;

// Data layout: [discriminator(u8), amount(u64 LE), decimals(u8)].
export function createTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: number | bigint,
  decimals: number,
  multiSigners: PublicKey[] = [],
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys = addSigners(
    [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
    ],
    owner,
    multiSigners,
  );
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  view.setUint8(0, TRANSFER_CHECKED_INSTRUCTION);
  view.setBigUint64(1, BigInt(amount), true);
  view.setUint8(9, decimals);
  return new TransactionInstruction({
    keys,
    programId,
    data: asInstructionData(data),
  });
}
