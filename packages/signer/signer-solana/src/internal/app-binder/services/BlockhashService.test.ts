import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  type Instruction,
  type Nonce,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageLifetimeUsingDurableNonce,
} from "@solana/kit";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

import { BlockhashService } from "./BlockhashService";

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

const KIT_FEE_PAYER = address(payer.toBase58());
const KIT_CO_SIGNER = address(recipient.toBase58());
const KIT_PROGRAM = address("Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo");
const KIT_NONCE_ACCOUNT = address(
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
);

/**
 * Builds real message bytes via `@solana/kit` for any supported version, with
 * either a blockhash or a durable-nonce lifetime (the latter prepends
 * `AdvanceNonceAccount`), and optionally a second required signer.
 */
function buildKitMessage(options: {
  version: "legacy" | 0 | 1;
  durableNonce?: boolean;
  coSigner?: boolean;
}): Uint8Array {
  const instruction: Instruction = {
    programAddress: KIT_PROGRAM,
    accounts: options.coSigner
      ? [{ address: KIT_CO_SIGNER, role: AccountRole.READONLY_SIGNER }]
      : [],
    data: new Uint8Array([1, 2, 3]),
  };
  const message = pipe(
    createTransactionMessage({ version: options.version }),
    (m) => setTransactionMessageFeePayer(KIT_FEE_PAYER, m),
    (m) =>
      options.durableNonce
        ? setTransactionMessageLifetimeUsingDurableNonce(
            {
              nonce: BLOCKHASH as Nonce,
              nonceAccountAddress: KIT_NONCE_ACCOUNT,
              nonceAuthorityAddress: KIT_FEE_PAYER,
            },
            m,
          )
        : setTransactionMessageLifetimeUsingBlockhash(
            { blockhash: blockhash(BLOCKHASH), lastValidBlockHeight: 1000n },
            m,
          ),
    (m) => appendTransactionMessageInstructions([instruction], m),
  );
  return new Uint8Array(compileTransaction(message).messageBytes);
}

describe("BlockhashService", () => {
  let service: BlockhashService;

  beforeEach(() => {
    service = new BlockhashService();
  });

  describe("locateBlockhashOffset", () => {
    it("should find the blockhash offset in a legacy message", () => {
      const msg = buildLegacyMessage();
      const offset = service.locateBlockhashOffset(msg);

      const foundBlockhash = msg.slice(offset, offset + 32);
      expect(foundBlockhash).toEqual(BLOCKHASH_BYTES);
    });

    it("should find the blockhash offset in a v0 message", () => {
      const msg = buildV0Message();
      const offset = service.locateBlockhashOffset(msg);

      const foundBlockhash = msg.slice(offset, offset + 32);
      expect(foundBlockhash).toEqual(BLOCKHASH_BYTES);
    });

    it.each(["legacy", 0, 1] as const)(
      "should find the blockhash offset in a real %s message",
      (version) => {
        const msg = buildKitMessage({ version });
        const offset = service.locateBlockhashOffset(msg);

        expect(msg.slice(offset, offset + 32)).toEqual(BLOCKHASH_BYTES);
      },
    );

    it("should find the blockhash at the fixed v1 offset", () => {
      expect(
        service.locateBlockhashOffset(buildKitMessage({ version: 1 })),
      ).toBe(8);
    });

    it("should throw on a v1 message too short to contain a blockhash", () => {
      expect(() =>
        service.locateBlockhashOffset(new Uint8Array([0x81, 1, 0, 0, 0, 0])),
      ).toThrow("Message too short to contain a blockhash");
    });

    it("should throw on truncated input", () => {
      expect(() =>
        service.locateBlockhashOffset(new Uint8Array([0x01])),
      ).toThrow();
    });

    it("should throw on empty input", () => {
      expect(() => service.locateBlockhashOffset(new Uint8Array([]))).toThrow();
    });

    it("should throw when message is too short for the declared accounts", () => {
      // Header says 1 required sig, 0 readonly signed, 0 readonly unsigned, 255 accounts
      // but message is only 7 bytes
      const msg = new Uint8Array([0x01, 0x00, 0x00, 0x81, 0x01, 0x00, 0x00]);
      expect(() => service.locateBlockhashOffset(msg)).toThrow(
        "Message too short to contain a blockhash",
      );
    });
  });

  describe("patchBlockhash", () => {
    it("should replace the blockhash in a legacy message", () => {
      const msg = buildLegacyMessage();
      const offset = service.locateBlockhashOffset(msg);
      const newHash = new Uint8Array(32).fill(0xab);

      const patched = service.patchBlockhash(msg, newHash);

      const patchedBlockhash = patched.slice(offset, offset + 32);
      expect(patchedBlockhash).toEqual(newHash);
    });

    it("should replace the blockhash in a v0 message", () => {
      const msg = buildV0Message();
      const offset = service.locateBlockhashOffset(msg);
      const newHash = new Uint8Array(32).fill(0xcd);

      const patched = service.patchBlockhash(msg, newHash);

      const patchedBlockhash = patched.slice(offset, offset + 32);
      expect(patchedBlockhash).toEqual(newHash);
    });

    it("should not modify bytes outside the blockhash region", () => {
      const msg = buildLegacyMessage();
      const offset = service.locateBlockhashOffset(msg);
      const newHash = new Uint8Array(32).fill(0xff);

      const patched = service.patchBlockhash(msg, newHash);

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

      service.patchBlockhash(msg, newHash);

      expect(msg).toEqual(originalCopy);
    });

    it("should throw if newBlockhash is not 32 bytes", () => {
      const msg = buildLegacyMessage();

      expect(() => service.patchBlockhash(msg, new Uint8Array(16))).toThrow(
        "newBlockhash must be 32 bytes",
      );
      expect(() => service.patchBlockhash(msg, new Uint8Array(64))).toThrow(
        "newBlockhash must be 32 bytes",
      );
    });
  });

  describe("getRefreshBlocker", () => {
    it.each(["legacy", 0, 1] as const)(
      "should allow refresh for a single-signer %s message",
      (version) => {
        expect(service.getRefreshBlocker(buildKitMessage({ version }))).toBe(
          null,
        );
      },
    );

    it("should allow refresh for a web3.js legacy transfer", () => {
      expect(service.getRefreshBlocker(buildLegacyMessage())).toBe(null);
    });

    it.each(["legacy", 0, 1] as const)(
      "should block refresh for a durable-nonce %s message",
      (version) => {
        expect(
          service.getRefreshBlocker(
            buildKitMessage({ version, durableNonce: true }),
          ),
        ).toBe("durableNonce");
      },
    );

    it("should block refresh for a web3.js durable-nonce transaction", () => {
      const tx = new Transaction({
        recentBlockhash: BLOCKHASH,
        feePayer: payer,
      });
      tx.add(
        SystemProgram.nonceAdvance({
          noncePubkey: new PublicKey(KIT_NONCE_ACCOUNT),
          authorizedPubkey: payer,
        }),
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: recipient,
          lamports: 1_000_000,
        }),
      );

      expect(
        service.getRefreshBlocker(Uint8Array.from(tx.serializeMessage())),
      ).toBe("durableNonce");
    });

    it("should allow refresh when AdvanceNonceAccount is not the first instruction", () => {
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
        SystemProgram.nonceAdvance({
          noncePubkey: new PublicKey(KIT_NONCE_ACCOUNT),
          authorizedPubkey: payer,
        }),
      );

      expect(
        service.getRefreshBlocker(Uint8Array.from(tx.serializeMessage())),
      ).toBe(null);
    });

    it.each(["legacy", 0, 1] as const)(
      "should block refresh for a %s message with a co-signer",
      (version) => {
        expect(
          service.getRefreshBlocker(
            buildKitMessage({ version, coSigner: true }),
          ),
        ).toBe("multipleSigners");
      },
    );

    it("should block refresh for an undecodable message", () => {
      expect(
        service.getRefreshBlocker(new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
      ).toBe("undecodable");
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

      const result = await service.fetchLatestBlockhash(
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
