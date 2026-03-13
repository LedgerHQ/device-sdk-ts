import { Keypair } from "@solana/web3.js";

import {
  COIN_DATA,
  GenerateSolanaTransaction,
} from "./GenerateSolanaTransaction";

describe("GenerateSolanaTransaction", () => {
  const generator = new GenerateSolanaTransaction();
  const validPayer = "2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB";
  const validRecipient = "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy";

  describe("generatePlainSolanaTransaction", () => {
    it("should return a valid base64-encoded string", () => {
      const result = generator.generatePlainSolanaTransaction(
        validPayer,
        validRecipient,
        1_000_000,
      );
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);

      const decoded = Buffer.from(result, "base64");
      expect(decoded.length).toBeGreaterThan(0);
    });

    it("should produce different output for different payers", () => {
      const result1 = generator.generatePlainSolanaTransaction(
        validPayer,
        validRecipient,
        1_000_000,
      );
      const result2 = generator.generatePlainSolanaTransaction(
        validRecipient,
        validPayer,
        1_000_000,
      );
      expect(result1).not.toEqual(result2);
    });

    it("should produce different output for different amounts", () => {
      const result1 = generator.generatePlainSolanaTransaction(
        validPayer,
        validRecipient,
        1_000_000,
      );
      const result2 = generator.generatePlainSolanaTransaction(
        validPayer,
        validRecipient,
        2_000_000,
      );
      expect(result1).not.toEqual(result2);
    });

    it("should support multiple transfers", () => {
      const single = generator.generatePlainSolanaTransaction(
        validPayer,
        validRecipient,
        1_000_000,
        1,
      );
      const double = generator.generatePlainSolanaTransaction(
        validPayer,
        validRecipient,
        1_000_000,
        2,
      );
      const decodedSingle = Buffer.from(single, "base64");
      const decodedDouble = Buffer.from(double, "base64");
      expect(decodedDouble.length).toBeGreaterThan(decodedSingle.length);
    });

    it("should throw for an invalid payer key", () => {
      expect(() =>
        generator.generatePlainSolanaTransaction(
          "invalid-key",
          validRecipient,
          1_000_000,
        ),
      ).toThrow();
    });
  });

  describe("generateUsdcTransaction", () => {
    const payer = Keypair.generate().publicKey.toBase58();
    const recipient = Keypair.generate().publicKey.toBase58();

    it("should return a valid base64-encoded string", () => {
      const result = generator.generateUsdcTransaction(payer, recipient, 10);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);

      const decoded = Buffer.from(result, "base64");
      expect(decoded.length).toBeGreaterThan(0);
    });

    it("should support multiple transfers", () => {
      const single = generator.generateUsdcTransaction(payer, recipient, 10, 1);
      const double = generator.generateUsdcTransaction(payer, recipient, 10, 2);
      const decodedSingle = Buffer.from(single, "base64");
      const decodedDouble = Buffer.from(double, "base64");
      expect(decodedDouble.length).toBeGreaterThan(decodedSingle.length);
    });
  });

  describe("generateSplTokenTransaction", () => {
    it("should return a valid base64-encoded string for a custom mint", () => {
      const payer = Keypair.generate().publicKey.toBase58();
      const recipient = Keypair.generate().publicKey.toBase58();
      const mint = COIN_DATA.USDC.mint.toBase58();

      const result = generator.generateSplTokenTransaction(
        payer,
        recipient,
        mint,
        100,
        6,
      );
      expect(typeof result).toBe("string");
      const decoded = Buffer.from(result, "base64");
      expect(decoded.length).toBeGreaterThan(0);
    });
  });
});
