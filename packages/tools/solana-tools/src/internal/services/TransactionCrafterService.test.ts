import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

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

import { TransactionCrafterService } from "./TransactionCrafterService";

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

  function buildLegacyMessageBase64(): string {
    const tx = new Transaction({
      recentBlockhash: "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg",
      feePayer: oldPayer,
    });
    tx.add(
      SystemProgram.transfer({
        fromPubkey: oldPayer,
        toPubkey: recipient,
        lamports: 1_000_000,
      }),
    );
    tx.signatures = [{ publicKey: oldPayer, signature: null }];
    const msg = tx.serializeMessage();
    return toBase64(msg);
  }

  describe("getCraftedTransaction", () => {
    it("should replace the payer in a legacy message", () => {
      const original = buildLegacyMessageBase64();
      const crafted = crafter.getCraftedTransaction(
        original,
        newPayer.toBase58(),
      );

      expect(crafted).not.toEqual(original);

      const craftedBytes = fromBase64(crafted);
      expect(craftedBytes.length).toBeGreaterThan(0);

      const craftedHex = Buffer.from(craftedBytes).toString("hex");
      const newPayerHex = Buffer.from(newPayer.toBytes()).toString("hex");
      expect(craftedHex).toContain(newPayerHex);

      const oldPayerHex = Buffer.from(oldPayer.toBytes()).toString("hex");
      expect(craftedHex).not.toContain(oldPayerHex);
    });

    it("should preserve the recipient key", () => {
      const original = buildLegacyMessageBase64();
      const crafted = crafter.getCraftedTransaction(
        original,
        newPayer.toBase58(),
      );

      const craftedBytes = fromBase64(crafted);
      const craftedHex = Buffer.from(craftedBytes).toString("hex");
      const recipientHex = Buffer.from(recipient.toBytes()).toString("hex");
      expect(craftedHex).toContain(recipientHex);
    });

    it("should throw for invalid base64 input", () => {
      expect(() =>
        crafter.getCraftedTransaction("!!!invalid!!!", newPayer.toBase58()),
      ).toThrow();
    });

    it("should throw for invalid base58 payer key", () => {
      const original = buildLegacyMessageBase64();
      expect(() =>
        crafter.getCraftedTransaction(original, "0OOO_not_base58"),
      ).toThrow();
    });

    it("should throw for garbage binary input", () => {
      const garbage = toBase64(new Uint8Array([0, 1, 2, 3]));
      expect(() =>
        crafter.getCraftedTransaction(garbage, newPayer.toBase58()),
      ).toThrow();
    });

    it("should be idempotent when payer is the same", () => {
      const original = buildLegacyMessageBase64();
      const crafted = crafter.getCraftedTransaction(
        original,
        oldPayer.toBase58(),
      );
      expect(crafted).toEqual(original);
    });
  });

  describe("decodeShortVec", () => {
    it("should decode single-byte value", () => {
      const bytes = new Uint8Array([5]);
      const result = crafter.decodeShortVec(bytes, 0);
      expect(result).toEqual({ length: 5, size: 1 });
    });

    it("should decode multi-byte value", () => {
      const bytes = new Uint8Array([0x80, 0x01]);
      const result = crafter.decodeShortVec(bytes, 0);
      expect(result).toEqual({ length: 128, size: 2 });
    });

    it("should respect offset", () => {
      const bytes = new Uint8Array([0xff, 3]);
      const result = crafter.decodeShortVec(bytes, 1);
      expect(result).toEqual({ length: 3, size: 1 });
    });

    it("should throw on overflow", () => {
      const bytes = new Uint8Array([]);
      expect(() => crafter.decodeShortVec(bytes, 0)).toThrow(
        "shortvec decode overflow",
      );
    });
  });
});
