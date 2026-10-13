import { PublicKey } from "@solana/web3.js";

// Raw legacy messages that `VersionedTransaction.deserialize` also accepts as a
// signed transaction. A one-signer message starts with 0x01, read as "one
// signature"; the next 64 bytes are skipped as that signature, and byte 65
// (byte 29 of the second account) is read as the header of a one-signer
// message. When that byte is 0x01, web3.js decodes garbage instead of
// throwing. Both shapes are real Ledger Wallet flows; the addresses here are
// placeholders, only the second account's tail and the instruction bytes
// matter.

const key = (base58: string) => new PublicKey(base58).toBytes();

/** 32-byte account filled with `fill`, ending with `tail`. */
const accountEndingWith = (fill: number, tail: number[]) => {
  const account = new Uint8Array(32).fill(fill);
  account.set(tail, 32 - tail.length);
  return account;
};

const concat = (...parts: ArrayLike<number>[]) =>
  Uint8Array.from(parts.flatMap((part) => Array.from(part)));

const FEE_PAYER = new Uint8Array(32).fill(0x11);
const BLOCKHASH = new Uint8Array(32).fill(0x33);
const COMPUTE_BUDGET_PROGRAM = key(
  "ComputeBudget111111111111111111111111111111",
);

/** Ledger Wallet unstake: SetComputeUnitLimit + Stake Deactivate. */
export const UNSTAKE_MESSAGE = concat(
  [1, 0, 3, 5], // 1 signer, 0 readonly signed, 3 readonly unsigned; 5 accounts
  FEE_PAYER,
  accountEndingWith(0x22, [0x01, 0x13, 0x37]), // stake account
  COMPUTE_BUDGET_PROGRAM,
  key("Stake11111111111111111111111111111111111111"),
  key("SysvarC1ock11111111111111111111111111111111"),
  BLOCKHASH,
  [2], // 2 instructions
  [2, 0, 5, 0x02, 0xb8, 0x30, 0x00, 0x00], // SetComputeUnitLimit(12472)
  [3, 3, 1, 4, 0, 4, 0x05, 0x00, 0x00, 0x00], // Deactivate [stake, clock, authority]
);

/** Ledger Wallet SOL send with a memo: SetComputeUnitLimit + Transfer + Memo. */
export const SEND_WITH_MEMO_MESSAGE = concat(
  [1, 0, 3, 5], // 1 signer, 0 readonly signed, 3 readonly unsigned; 5 accounts
  FEE_PAYER,
  accountEndingWith(0x22, [0x01, 0x07, 0xb0]), // recipient
  COMPUTE_BUDGET_PROGRAM,
  key("11111111111111111111111111111111"),
  key("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
  BLOCKHASH,
  [3], // 3 instructions
  [2, 0, 5, 0x02, 0x25, 0x0f, 0x00, 0x00], // SetComputeUnitLimit(3877)
  [3, 2, 0, 1, 12, 2, 0, 0, 0, 0xce, 0x8c, 0xae, 0x0a, 0, 0, 0, 0], // Transfer
  [4, 0, 5, ...new TextEncoder().encode("hello")], // Memo
);

/** Wraps a one-signer message in the legacy/v0 wire format. */
export const withOneSignature = (message: Uint8Array) =>
  concat([1], new Uint8Array(64).fill(0x44), message);
