import {
  type AccountMeta,
  type PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  addSigners,
  asInstructionData as asData,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@internal/app-binder/services/utils/splToken";

// Test-only SPL Token instruction builders, inlined from `@solana/spl-token`
// (see splToken.ts). Byte-for-byte equivalence is locked by golden vectors in
// splTokenTestBuilders.test.ts.

export { createTransferCheckedInstruction };

const Discriminator = {
  Transfer: 3,
  InitializeAccount: 1,
  CloseAccount: 9,
  SyncNative: 17,
  InitializeAccount2: 16,
  InitializeAccount3: 18,
} as const;

function discAndAmount(discriminator: number, amount: bigint): Uint8Array {
  const bytes = new Uint8Array(9);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, discriminator);
  view.setBigUint64(1, amount, true);
  return bytes;
}

export function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: number | bigint,
  multiSigners: PublicKey[] = [],
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys = addSigners(
    [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
    ],
    owner,
    multiSigners,
  );
  return new TransactionInstruction({
    keys,
    programId,
    data: asData(discAndAmount(Discriminator.Transfer, BigInt(amount))),
  });
}

export function createInitializeAccountInstruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId,
    data: asData(new Uint8Array([Discriminator.InitializeAccount])),
  });
}

function discAndOwner(discriminator: number, owner: PublicKey): Uint8Array {
  const ownerBytes = owner.toBytes();
  const bytes = new Uint8Array(1 + ownerBytes.length);
  bytes[0] = discriminator;
  bytes.set(ownerBytes, 1);
  return bytes;
}

export function createInitializeAccount2Instruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId,
    data: asData(discAndOwner(Discriminator.InitializeAccount2, owner)),
  });
}

export function createInitializeAccount3Instruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId,
    data: asData(discAndOwner(Discriminator.InitializeAccount3, owner)),
  });
}

export function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
  associatedTokenProgramId: PublicKey = ASSOCIATED_TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: programId, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId: associatedTokenProgramId,
    data: asData(new Uint8Array(0)),
  });
}

export function createCloseAccountInstruction(
  account: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  multiSigners: PublicKey[] = [],
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys = addSigners(
    [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
    ],
    authority,
    multiSigners,
  );
  return new TransactionInstruction({
    keys,
    programId,
    data: asData(new Uint8Array([Discriminator.CloseAccount])),
  });
}

export function createSyncNativeInstruction(
  account: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: account, isSigner: false, isWritable: true },
  ];
  return new TransactionInstruction({
    keys,
    programId,
    data: asData(new Uint8Array([Discriminator.SyncNative])),
  });
}
