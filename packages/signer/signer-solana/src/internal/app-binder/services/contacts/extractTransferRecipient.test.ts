import {
  AddressLookupTableAccount,
  Keypair,
  type PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";

import {
  createTransferCheckedInstruction,
  createTransferInstruction,
} from "@internal/app-binder/services/__test-utils__/splTokenBuilders";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@internal/app-binder/services/utils/splToken";

import { extractTransferRecipient } from "./extractTransferRecipient";

const BLOCKHASH = "11111111111111111111111111111111";
const MEMO_PROGRAM = Keypair.generate().publicKey;

const payer = Keypair.generate().publicKey;
const alice = Keypair.generate().publicKey;
const bob = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;
const sourceTokenAccount = Keypair.generate().publicKey;
const aliceTokenAccount = Keypair.generate().publicKey;

function legacyMessage(...instructions: TransactionInstruction[]): Uint8Array {
  const tx = new Transaction({ feePayer: payer, recentBlockhash: BLOCKHASH });
  tx.add(...instructions);
  return tx.serializeMessage();
}

function solTransfer(to: PublicKey): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: to,
    lamports: 1_000,
  });
}

function memo(): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM,
    data: Buffer.from("hello"),
  });
}

describe("extractTransferRecipient", () => {
  describe("native transfers", () => {
    it("returns the recipient of a SystemProgram transfer", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(solTransfer(alice)),
      );

      expect(recipient).toEqual({ kind: "native", address: alice });
    });

    it("returns the recipient of a SystemProgram transfer with seed", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(
          SystemProgram.transfer({
            fromPubkey: Keypair.generate().publicKey,
            basePubkey: payer,
            toPubkey: alice,
            lamports: 1_000,
            seed: "seed",
            programId: SystemProgram.programId,
          }),
        ),
      );

      expect(recipient).toEqual({ kind: "native", address: alice });
    });

    it("ignores instructions that transfer nothing", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(memo(), solTransfer(alice), memo()),
      );

      expect(recipient).toEqual({ kind: "native", address: alice });
    });

    it("ignores System Program instructions other than transfers", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(
          SystemProgram.createAccount({
            fromPubkey: payer,
            newAccountPubkey: bob,
            lamports: 1_000,
            space: 0,
            programId: SystemProgram.programId,
          }),
          solTransfer(alice),
        ),
      );

      expect(recipient).toEqual({ kind: "native", address: alice });
    });

    it("returns the recipient once when it receives several transfers", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(solTransfer(alice), solTransfer(alice)),
      );

      expect(recipient).toEqual({ kind: "native", address: alice });
    });
  });

  describe("token transfers", () => {
    it("returns the destination token account, mint and program of a TransferChecked", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(
          createTransferCheckedInstruction(
            sourceTokenAccount,
            mint,
            aliceTokenAccount,
            payer,
            10,
            6,
          ),
        ),
      );

      expect(recipient).toEqual({
        kind: "token",
        tokenAccount: aliceTokenAccount,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      });
    });

    it("keeps the Token-2022 program of a TransferChecked", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(
          createTransferCheckedInstruction(
            sourceTokenAccount,
            mint,
            aliceTokenAccount,
            payer,
            10,
            6,
            [],
            TOKEN_2022_PROGRAM_ID,
          ),
        ),
      );

      expect(recipient?.kind).toBe("token");
      expect(
        recipient?.kind === "token" &&
          recipient.tokenProgram.equals(TOKEN_2022_PROGRAM_ID),
      ).toBe(true);
    });

    it("reads a Token-2022 TransferCheckedWithFee like a TransferChecked", async () => {
      const ix = createTransferCheckedInstruction(
        sourceTokenAccount,
        mint,
        aliceTokenAccount,
        payer,
        10,
        6,
        [],
        TOKEN_2022_PROGRAM_ID,
      );
      const withFee = new TransactionInstruction({
        keys: ix.keys,
        programId: TOKEN_2022_PROGRAM_ID,
        data: Buffer.from([26, 1, ...new Array<number>(17).fill(0)]),
      });

      const recipient = await extractTransferRecipient(legacyMessage(withFee));

      expect(recipient).toMatchObject({
        kind: "token",
        tokenAccount: aliceTokenAccount,
        mint,
      });
    });

    it("gives up on a plain Transfer, which carries no mint", async () => {
      const recipient = await extractTransferRecipient(
        legacyMessage(
          createTransferInstruction(
            sourceTokenAccount,
            aliceTokenAccount,
            payer,
            10,
          ),
        ),
      );

      expect(recipient).toBeUndefined();
    });
  });

  describe("ambiguous transactions", () => {
    it("returns undefined without any transfer", async () => {
      expect(
        await extractTransferRecipient(legacyMessage(memo())),
      ).toBeUndefined();
    });

    it("returns undefined when transfers go to several recipients", async () => {
      expect(
        await extractTransferRecipient(
          legacyMessage(solTransfer(alice), solTransfer(bob)),
        ),
      ).toBeUndefined();
    });

    it("returns undefined when a native and a token transfer are mixed", async () => {
      expect(
        await extractTransferRecipient(
          legacyMessage(
            solTransfer(alice),
            createTransferCheckedInstruction(
              sourceTokenAccount,
              mint,
              aliceTokenAccount,
              payer,
              10,
              6,
            ),
          ),
        ),
      ).toBeUndefined();
    });

    it("returns undefined for bytes that are no message", async () => {
      expect(
        await extractTransferRecipient(new Uint8Array([1, 2, 3])),
      ).toBeUndefined();
    });

    it("returns undefined when the recipient sits in an address lookup table", async () => {
      const lookupTable = new AddressLookupTableAccount({
        key: Keypair.generate().publicKey,
        state: {
          deactivationSlot: BigInt("18446744073709551615"),
          lastExtendedSlot: 0,
          lastExtendedSlotStartIndex: 0,
          authority: payer,
          addresses: [alice],
        },
      });
      const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: BLOCKHASH,
        instructions: [solTransfer(alice)],
      }).compileToV0Message([lookupTable]);

      expect(
        await extractTransferRecipient(message.serialize()),
      ).toBeUndefined();
    });

    it("reads a v0 message whose recipient is a static key", async () => {
      const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: BLOCKHASH,
        instructions: [solTransfer(alice)],
      }).compileToV0Message();

      expect(await extractTransferRecipient(message.serialize())).toEqual({
        kind: "native",
        address: alice,
      });
    });
  });
});
