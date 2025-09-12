// import {
//   createInitializeAccountInstruction,
//   createTransferCheckedInstruction,
//   createTransferInstruction,
//   TOKEN_PROGRAM_ID,
// } from "@solana/spl-token";
// import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
// import bs58 from "bs58";
// import { describe, expect, it } from "vitest";

// import {
//   SolanaTransactionTypes,
//   TransactionInspector,
// } from "./TransactionInspector";

// const DUMMY_BLOCKHASH = bs58.encode(new Uint8Array(32).fill(1));

// describe("TransactionInspector", () => {
//   it("falls back to STANDARD for a plain SystemProgram transfer", () => {
//     const payer = Keypair.generate();
//     const dest = Keypair.generate().publicKey;

//     const tx = new Transaction().add(
//       SystemProgram.transfer({
//         fromPubkey: payer.publicKey,
//         toPubkey: dest,
//         lamports: 1_000,
//       }),
//     );
//     tx.recentBlockhash = DUMMY_BLOCKHASH;
//     tx.feePayer = payer.publicKey;
//     tx.sign(payer);

//     const raw = tx.serialize();
//     const result = new TransactionInspector(raw).inspectTransactionType();

//     expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
//     expect(result.data).toEqual({});
//   });

//   it("detects an SPL Transfer and returns the destination address", () => {
//     const payer = Keypair.generate();
//     const source = Keypair.generate().publicKey;
//     const destination = Keypair.generate().publicKey;
//     const owner = payer.publicKey;

//     const tx = new Transaction().add(
//       createTransferInstruction(
//         source,
//         destination,
//         owner,
//         42n,
//         [],
//         TOKEN_PROGRAM_ID,
//       ),
//     );
//     tx.recentBlockhash = DUMMY_BLOCKHASH;
//     tx.feePayer = payer.publicKey;
//     tx.sign(payer);

//     const result = new TransactionInspector(
//       tx.serialize(),
//     ).inspectTransactionType();

//     expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
//     expect(result.data.tokenAddress).toBe(destination.toBase58());
//   });

//   it("detects an SPL TransferChecked and returns the destination address", () => {
//     const payer = Keypair.generate();
//     const mint = Keypair.generate().publicKey;
//     const source = Keypair.generate().publicKey;
//     const destination = Keypair.generate().publicKey;
//     const owner = payer.publicKey;

//     const tx = new Transaction().add(
//       createTransferCheckedInstruction(
//         source,
//         mint,
//         destination,
//         owner,
//         123n,
//         0,
//         [],
//         TOKEN_PROGRAM_ID,
//       ),
//     );
//     tx.recentBlockhash = DUMMY_BLOCKHASH;
//     tx.feePayer = payer.publicKey;
//     tx.sign(payer);

//     const result = new TransactionInspector(
//       tx.serialize(),
//     ).inspectTransactionType();

//     expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
//     expect(result.data.tokenAddress).toBe(destination.toBase58());
//   });

//   it("detects an SPL InitializeAccount and returns the new ATA and mint", () => {
//     const payer = Keypair.generate();
//     const mint = Keypair.generate().publicKey;
//     const newAccount = Keypair.generate().publicKey;
//     const owner = payer.publicKey;

//     const tx = new Transaction().add(
//       createInitializeAccountInstruction(
//         newAccount,
//         mint,
//         owner,
//         TOKEN_PROGRAM_ID,
//       ),
//     );
//     tx.recentBlockhash = DUMMY_BLOCKHASH;
//     tx.feePayer = payer.publicKey;
//     tx.sign(payer);

//     const result = new TransactionInspector(
//       tx.serialize(),
//     ).inspectTransactionType();

//     expect(result.transactionType).toBe(SolanaTransactionTypes.SPL);
//     expect(result.data.createATA).toEqual({
//       address: newAccount.toBase58(),
//       mintAddress: mint.toBase58(),
//     });
//   });

//   it("falls back to STANDARD if the payload is unparseable", () => {
//     const garbage = new Uint8Array([0, 1, 2, 3, 4, 5]);
//     const result = new TransactionInspector(garbage).inspectTransactionType();

//     expect(result.transactionType).toBe(SolanaTransactionTypes.STANDARD);
//     expect(result.data).toEqual({});
//   });
// });
