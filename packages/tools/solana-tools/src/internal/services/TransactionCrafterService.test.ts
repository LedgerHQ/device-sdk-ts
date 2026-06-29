import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

vi.mock("@ledgerhq/device-management-kit", () => ({
  base64StringToBuffer: (value: string): Uint8Array | null => {
    if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
    return fromBase64(value);
  },
  bufferToBase64String: (bytes: Uint8Array): string => {
    return toBase64(bytes);
  },
}));

import {
  type CraftOptions,
  TransactionCrafterService,
} from "./TransactionCrafterService";

const BLOCKHASH = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";

describe("TransactionCrafterService", () => {
  const crafter = new TransactionCrafterService();
  const oldPayer = new PublicKey(
    "2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB",
  );
  const newPayer = new PublicKey(
    "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",
  );
  const recipient = new PublicKey(
    "7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2",
  );

  function craft(base64: string, options: CraftOptions): VersionedMessage {
    return VersionedMessage.deserialize(
      fromBase64(crafter.getCraftedTransaction(base64, options)),
    );
  }

  function legacyTransferMessage(): string {
    const message = new TransactionMessage({
      payerKey: oldPayer,
      recentBlockhash: BLOCKHASH,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: oldPayer,
          toPubkey: recipient,
          lamports: 1_000_000,
        }),
      ],
    }).compileToLegacyMessage();
    return toBase64(message.serialize());
  }

  describe("auto-detect mode", () => {
    it("should replace the payer in a legacy message", () => {
      const crafted = craft(legacyTransferMessage(), {
        payer: newPayer.toBase58(),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(newPayer.toBase58());
      expect(keys).not.toContain(oldPayer.toBase58());
    });

    it("should preserve the recipient and the blockhash", () => {
      const crafted = craft(legacyTransferMessage(), {
        payer: newPayer.toBase58(),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(recipient.toBase58());
      expect(crafted.recentBlockhash).toBe(BLOCKHASH);
    });

    it("should re-point the old payer's ATA to the new payer's ATA", () => {
      const mint = new PublicKey(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      const oldAta = getAssociatedTokenAddressSync(
        mint,
        oldPayer,
        true,
        TOKEN_PROGRAM_ID,
      );
      const newAta = getAssociatedTokenAddressSync(
        mint,
        newPayer,
        true,
        TOKEN_PROGRAM_ID,
      );

      const message = new TransactionMessage({
        payerKey: oldPayer,
        recentBlockhash: BLOCKHASH,
        instructions: [
          new TransactionInstruction({
            programId: TOKEN_PROGRAM_ID,
            keys: [
              { pubkey: oldAta, isSigner: false, isWritable: true },
              { pubkey: mint, isSigner: false, isWritable: false },
              { pubkey: oldPayer, isSigner: true, isWritable: true },
            ],
            data: Buffer.from([3, 0, 0, 0, 0, 0, 0, 0, 0]),
          }),
        ],
      }).compileToLegacyMessage();

      const crafted = craft(toBase64(message.serialize()), {
        payer: newPayer.toBase58(),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(newAta.toBase58());
      expect(keys).not.toContain(oldAta.toBase58());
      // The mint is untouched.
      expect(keys).toContain(mint.toBase58());
    });

    it("should re-point a TOKEN-2022 ATA", () => {
      const mint = new PublicKey(
        "9BcWFP4iAFmyT7QkpfRsTm6qkAxqYjZpFMDxZuTGZ6e9",
      );
      const oldAta = getAssociatedTokenAddressSync(
        mint,
        oldPayer,
        true,
        TOKEN_2022_PROGRAM_ID,
      );
      const newAta = getAssociatedTokenAddressSync(
        mint,
        newPayer,
        true,
        TOKEN_2022_PROGRAM_ID,
      );

      const message = new TransactionMessage({
        payerKey: oldPayer,
        recentBlockhash: BLOCKHASH,
        instructions: [
          new TransactionInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            keys: [
              { pubkey: oldAta, isSigner: false, isWritable: true },
              { pubkey: mint, isSigner: false, isWritable: false },
              { pubkey: oldPayer, isSigner: true, isWritable: true },
            ],
            data: Buffer.from([3, 0, 0, 0, 0, 0, 0, 0, 0]),
          }),
        ],
      }).compileToLegacyMessage();

      const crafted = craft(toBase64(message.serialize()), {
        payer: newPayer.toBase58(),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(newAta.toBase58());
      expect(keys).not.toContain(oldAta.toBase58());
    });

    it("should pass ComputeBudget instructions through untouched", () => {
      const message = new TransactionMessage({
        payerKey: oldPayer,
        recentBlockhash: BLOCKHASH,
        instructions: [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
          SystemProgram.transfer({
            fromPubkey: oldPayer,
            toPubkey: recipient,
            lamports: 1_000_000,
          }),
        ],
      }).compileToLegacyMessage();

      const crafted = craft(toBase64(message.serialize()), {
        payer: newPayer.toBase58(),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(ComputeBudgetProgram.programId.toBase58());
      expect(keys).toContain(newPayer.toBase58());
    });

    it("should be idempotent when payer is unchanged", () => {
      const original = legacyTransferMessage();
      const crafted = crafter.getCraftedTransaction(original, {
        payer: oldPayer.toBase58(),
      });
      expect(crafted).toBe(original);
    });
  });

  describe("round-trip", () => {
    it("should reproduce the message when there are no replacements", () => {
      const original = legacyTransferMessage();
      const crafted = crafter.getCraftedTransaction(original, {});
      expect(crafted).toBe(original);
    });
  });

  describe("explicit-map mode with ALTs", () => {
    const programId = new PublicKey(
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    );
    const altSupplied = new PublicKey(
      "So11111111111111111111111111111111111111112",
    );
    const replacement = new PublicKey(
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    );

    function lookupTable(): AddressLookupTableAccount {
      return new AddressLookupTableAccount({
        key: new PublicKey("HzMoc78z1VPHQwP1XQ3oM8oqkLW9bu2hZqScDpfEjBpd"),
        state: {
          // u64 max: an active (never deactivated) table.
          deactivationSlot: 18446744073709551615n,
          lastExtendedSlot: 0,
          lastExtendedSlotStartIndex: 0,
          authority: undefined,
          addresses: [altSupplied],
        },
      });
    }

    function v0WithAltMessage(alt: AddressLookupTableAccount): string {
      const message = new TransactionMessage({
        payerKey: oldPayer,
        recentBlockhash: BLOCKHASH,
        instructions: [
          new TransactionInstruction({
            programId,
            keys: [
              { pubkey: oldPayer, isSigner: true, isWritable: true },
              { pubkey: altSupplied, isSigner: false, isWritable: true },
            ],
            data: Buffer.from([]),
          }),
        ],
      }).compileToV0Message([alt]);
      return toBase64(message.serialize());
    }

    it("should promote a replaced ALT-supplied account into the static keys", () => {
      const alt = lookupTable();
      const original = VersionedMessage.deserialize(
        fromBase64(v0WithAltMessage(alt)),
      );
      // Sanity check: the account is supplied via the lookup table, not static.
      expect(original.staticAccountKeys.map((k) => k.toBase58())).not.toContain(
        altSupplied.toBase58(),
      );

      const crafted = craft(v0WithAltMessage(alt), {
        replacements: new Map([
          [altSupplied.toBase58(), replacement.toBase58()],
        ]),
        addressLookupTableAccounts: [alt],
      });

      expect(crafted.version).toBe(0);
      const staticKeys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(staticKeys).toContain(replacement.toBase58());

      const decompiled = TransactionMessage.decompile(crafted, {
        addressLookupTableAccounts: [alt],
      });
      const keys = decompiled.instructions[0]!.keys.map((k) =>
        k.pubkey.toBase58(),
      );
      expect(keys).toContain(replacement.toBase58());
      expect(keys).not.toContain(altSupplied.toBase58());
    });

    it("should let explicit pairs override auto-detect entries", () => {
      const override = new PublicKey(
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      );
      const crafted = craft(legacyTransferMessage(), {
        payer: newPayer.toBase58(),
        replacements: new Map([[oldPayer.toBase58(), override.toBase58()]]),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(override.toBase58());
      expect(keys).not.toContain(newPayer.toBase58());
    });

    it("should apply a replacement whose key has surrounding whitespace", () => {
      const crafted = craft(legacyTransferMessage(), {
        replacements: new Map([
          [`  ${oldPayer.toBase58()}\n`, newPayer.toBase58()],
        ]),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(newPayer.toBase58());
      expect(keys).not.toContain(oldPayer.toBase58());
    });
  });

  describe("full transaction input", () => {
    it("should drop signatures and emit the crafted message", () => {
      const message = new TransactionMessage({
        payerKey: oldPayer,
        recentBlockhash: BLOCKHASH,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: oldPayer,
            toPubkey: recipient,
            lamports: 1_000_000,
          }),
        ],
      }).compileToV0Message();
      const transaction = new VersionedTransaction(message);

      const crafted = craft(toBase64(transaction.serialize()), {
        payer: newPayer.toBase58(),
      });

      const keys = crafted.staticAccountKeys.map((k) => k.toBase58());
      expect(keys).toContain(newPayer.toBase58());
      expect(keys).not.toContain(oldPayer.toBase58());
    });
  });

  describe("errors", () => {
    it("should throw for invalid base64 input", () => {
      expect(() =>
        crafter.getCraftedTransaction("!!!invalid!!!", {
          payer: newPayer.toBase58(),
        }),
      ).toThrow();
    });

    it("should throw for an invalid base58 payer key", () => {
      expect(() =>
        crafter.getCraftedTransaction(legacyTransferMessage(), {
          payer: "0OOO_not_base58",
        }),
      ).toThrow("Failed to decode public key from base58.");
    });

    it("should throw for garbage binary input", () => {
      const garbage = toBase64(new Uint8Array([0, 1, 2, 3]));
      expect(() =>
        crafter.getCraftedTransaction(garbage, { payer: newPayer.toBase58() }),
      ).toThrow();
    });
  });
});
