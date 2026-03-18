import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

import {
  fetchLatestBlockhash,
  locateBlockhashOffset,
  patchBlockhash,
  zeroBlockhash,
} from "./BlockhashService";

vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return {
    ...actual,
    Connection: vi.fn(),
  };
});

const BLOCKHASH = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";
const BLOCKHASH_BYTES = bs58.decode(BLOCKHASH);

const payer = new PublicKey("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
const recipient = new PublicKey("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");

function buildLegacyMessage(): Uint8Array {
  const tx = new Transaction({
    recentBlockhash: BLOCKHASH,
    feePayer: payer,
  });
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports: 1_000_000,
    }),
  );
  // Ensure plain Uint8Array (serializeMessage returns Buffer in Node)
  return Uint8Array.from(tx.serializeMessage());
}

function buildV0Message(): Uint8Array {
  const legacyBytes = buildLegacyMessage();
  const v0Bytes = new Uint8Array(legacyBytes.length + 1);
  v0Bytes[0] = 0x80; // version 0 prefix
  v0Bytes.set(legacyBytes, 1);
  return v0Bytes;
}

describe("BlockhashService", () => {
  describe("locateBlockhashOffset", () => {
    it("should find the blockhash offset in a legacy message", () => {
      const msg = buildLegacyMessage();
      const offset = locateBlockhashOffset(msg);

      const foundBlockhash = msg.slice(offset, offset + 32);
      expect(foundBlockhash).toEqual(BLOCKHASH_BYTES);
    });

    it("should find the blockhash offset in a v0 message", () => {
      const msg = buildV0Message();
      const offset = locateBlockhashOffset(msg);

      const foundBlockhash = msg.slice(offset, offset + 32);
      expect(foundBlockhash).toEqual(BLOCKHASH_BYTES);
    });

    it("should throw on truncated input", () => {
      expect(() => locateBlockhashOffset(new Uint8Array([0x01]))).toThrow();
    });

    it("should throw on empty input", () => {
      expect(() => locateBlockhashOffset(new Uint8Array([]))).toThrow();
    });

    it("should throw when message is too short for the declared accounts", () => {
      // Header says 1 required sig, 0 readonly signed, 0 readonly unsigned, 255 accounts
      // but message is only 7 bytes
      const msg = new Uint8Array([0x01, 0x00, 0x00, 0x81, 0x01, 0x00, 0x00]);
      expect(() => locateBlockhashOffset(msg)).toThrow(
        "Message too short to contain a blockhash",
      );
    });
  });

  describe("zeroBlockhash", () => {
    it("should zero the blockhash in a legacy message", () => {
      const msg = buildLegacyMessage();
      const offset = locateBlockhashOffset(msg);

      const zeroed = zeroBlockhash(msg);

      const zeroedBlockhash = zeroed.slice(offset, offset + 32);
      expect(zeroedBlockhash).toEqual(new Uint8Array(32));
    });

    it("should zero the blockhash in a v0 message", () => {
      const msg = buildV0Message();
      const offset = locateBlockhashOffset(msg);

      const zeroed = zeroBlockhash(msg);

      const zeroedBlockhash = zeroed.slice(offset, offset + 32);
      expect(zeroedBlockhash).toEqual(new Uint8Array(32));
    });

    it("should not modify bytes outside the blockhash region", () => {
      const msg = buildLegacyMessage();
      const offset = locateBlockhashOffset(msg);

      const zeroed = zeroBlockhash(msg);

      const beforeOriginal = msg.slice(0, offset);
      const beforeZeroed = zeroed.slice(0, offset);
      expect(beforeZeroed).toEqual(beforeOriginal);

      const afterOriginal = msg.slice(offset + 32);
      const afterZeroed = zeroed.slice(offset + 32);
      expect(afterZeroed).toEqual(afterOriginal);
    });

    it("should not mutate the original message", () => {
      const msg = buildLegacyMessage();
      const originalCopy = new Uint8Array(msg);

      zeroBlockhash(msg);

      expect(msg).toEqual(originalCopy);
    });
  });

  describe("patchBlockhash", () => {
    it("should replace the blockhash in a legacy message", () => {
      const msg = buildLegacyMessage();
      const offset = locateBlockhashOffset(msg);
      const newHash = new Uint8Array(32).fill(0xab);

      const patched = patchBlockhash(msg, newHash);

      const patchedBlockhash = patched.slice(offset, offset + 32);
      expect(patchedBlockhash).toEqual(newHash);
    });

    it("should replace the blockhash in a v0 message", () => {
      const msg = buildV0Message();
      const offset = locateBlockhashOffset(msg);
      const newHash = new Uint8Array(32).fill(0xcd);

      const patched = patchBlockhash(msg, newHash);

      const patchedBlockhash = patched.slice(offset, offset + 32);
      expect(patchedBlockhash).toEqual(newHash);
    });

    it("should not modify bytes outside the blockhash region", () => {
      const msg = buildLegacyMessage();
      const offset = locateBlockhashOffset(msg);
      const newHash = new Uint8Array(32).fill(0xff);

      const patched = patchBlockhash(msg, newHash);

      const beforeOriginal = msg.slice(0, offset);
      const beforePatched = patched.slice(0, offset);
      expect(beforePatched).toEqual(beforeOriginal);

      const afterOriginal = msg.slice(offset + 32);
      const afterPatched = patched.slice(offset + 32);
      expect(afterPatched).toEqual(afterOriginal);
    });

    it("should not mutate the original message", () => {
      const msg = buildLegacyMessage();
      const originalCopy = new Uint8Array(msg);
      const newHash = new Uint8Array(32).fill(0xaa);

      patchBlockhash(msg, newHash);

      expect(msg).toEqual(originalCopy);
    });

    it("should throw if newBlockhash is not 32 bytes", () => {
      const msg = buildLegacyMessage();

      expect(() => patchBlockhash(msg, new Uint8Array(16))).toThrow(
        "newBlockhash must be 32 bytes",
      );
      expect(() => patchBlockhash(msg, new Uint8Array(64))).toThrow(
        "newBlockhash must be 32 bytes",
      );
    });
  });

  describe("zeroBlockhash + patchBlockhash roundtrip", () => {
    it("should restore the original message after zero then patch with original blockhash", () => {
      const msg = buildLegacyMessage();
      const offset = locateBlockhashOffset(msg);
      const originalBlockhash = msg.slice(offset, offset + 32);

      const zeroed = zeroBlockhash(msg);
      const restored = patchBlockhash(zeroed, originalBlockhash);

      expect(restored).toEqual(msg);
    });
  });

  describe("fetchLatestBlockhash", () => {
    it("should fetch and decode a blockhash from the RPC", async () => {
      const { Connection } = await import("@solana/web3.js");
      const mockGetLatestBlockhash = vi.fn().mockResolvedValue({
        blockhash: BLOCKHASH,
        lastValidBlockHeight: 100,
      });
      vi.mocked(Connection).mockImplementation(
        () =>
          ({
            getLatestBlockhash: mockGetLatestBlockhash,
          }) as unknown as InstanceType<typeof Connection>,
      );

      const result = await fetchLatestBlockhash(
        "https://api.mainnet-beta.solana.com",
      );

      expect(result).toEqual(BLOCKHASH_BYTES);
      expect(Connection).toHaveBeenCalledWith(
        "https://api.mainnet-beta.solana.com",
        { commitment: "finalized" },
      );
      expect(mockGetLatestBlockhash).toHaveBeenCalledWith("finalized");
    });
  });
});
