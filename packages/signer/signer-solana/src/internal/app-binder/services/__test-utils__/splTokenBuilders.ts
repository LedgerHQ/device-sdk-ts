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
// splTokenBuilders.test.ts.

export { createTransferCheckedInstruction };

const Discriminator = {
  Transfer: 3,
  InitializeAccount: 1,
  CloseAccount: 9,
  SyncNative: 17,
  InitializeAccount2: 16,
  InitializeAccount3: 18,
} as const;

const writable = (pubkey: PublicKey): AccountMeta => ({
  pubkey,
  isSigner: false,
  isWritable: true,
});
const readonly = (pubkey: PublicKey): AccountMeta => ({
  pubkey,
  isSigner: false,
  isWritable: false,
});
const signerWritable = (pubkey: PublicKey): AccountMeta => ({
  pubkey,
  isSigner: true,
  isWritable: true,
});

const discByte = (discriminator: number) =>
  asData(new Uint8Array([discriminator]));

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
    [writable(source), writable(destination)],
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
  return new TransactionInstruction({
    keys: [
      writable(account),
      readonly(mint),
      readonly(owner),
      readonly(SYSVAR_RENT_PUBKEY),
    ],
    programId,
    data: discByte(Discriminator.InitializeAccount),
  });
}

// InitializeAccount2 and InitializeAccount3 differ only by their discriminator
// and whether the rent sysvar account is included; both carry the owner in the
// instruction data rather than as an account.
function createInitializeAccountWithOwnerData(
  discriminator: number,
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  includeRent: boolean,
  programId: PublicKey,
): TransactionInstruction {
  const keys = [writable(account), readonly(mint)];
  if (includeRent) keys.push(readonly(SYSVAR_RENT_PUBKEY));

  const ownerBytes = owner.toBytes();
  const data = new Uint8Array(1 + ownerBytes.length);
  data[0] = discriminator;
  data.set(ownerBytes, 1);

  return new TransactionInstruction({ keys, programId, data: asData(data) });
}

export function createInitializeAccount2Instruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  return createInitializeAccountWithOwnerData(
    Discriminator.InitializeAccount2,
    account,
    mint,
    owner,
    true,
    programId,
  );
}

export function createInitializeAccount3Instruction(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  return createInitializeAccountWithOwnerData(
    Discriminator.InitializeAccount3,
    account,
    mint,
    owner,
    false,
    programId,
  );
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
    signerWritable(payer),
    writable(associatedToken),
    readonly(owner),
    readonly(mint),
    readonly(SystemProgram.programId),
    readonly(programId),
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
    [writable(account), writable(destination)],
    authority,
    multiSigners,
  );
  return new TransactionInstruction({
    keys,
    programId,
    data: discByte(Discriminator.CloseAccount),
  });
}

export function createSyncNativeInstruction(
  account: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [writable(account)],
    programId,
    data: discByte(Discriminator.SyncNative),
  });
}
