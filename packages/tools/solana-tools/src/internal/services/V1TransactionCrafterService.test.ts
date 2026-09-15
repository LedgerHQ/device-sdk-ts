import { type Address, address } from "@solana/addresses";
import { blockhash } from "@solana/rpc-types";
import {
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createTransactionMessage,
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/transaction-messages";
import { PublicKey } from "@solana/web3.js";

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

import { type DecompiledV1Message } from "./crafter/deserializeV1";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./utils/splToken";
import {
  type V1CraftOptions,
  V1TransactionCrafterService,
} from "./V1TransactionCrafterService";

// AccountRole (from @solana/instructions): READONLY=0, WRITABLE=1,
// READONLY_SIGNER=2, WRITABLE_SIGNER=3.
const WRITABLE = 1;

const BLOCKHASH = blockhash("a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg");
const TOKEN_PROGRAM_ADDRESS = address(TOKEN_PROGRAM_ID.toBase58());
const TOKEN_2022_PROGRAM_ADDRESS = address(TOKEN_2022_PROGRAM_ID.toBase58());

describe("V1TransactionCrafterService", () => {
  const crafter = new V1TransactionCrafterService();
  const oldPayer = address("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
  const newPayer = address("DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy");
  const recipient = address("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");
  const program = address("11111111111111111111111111111111");

  function craft(base64: string, options: V1CraftOptions): DecompiledV1Message {
    const bytes = fromBase64(crafter.getCraftedTransaction(base64, options));
    return decompileTransactionMessage(
      getCompiledTransactionMessageDecoder().decode(bytes),
    ) as DecompiledV1Message;
  }

  function transferMessageBytes(): Uint8Array {
    const withFeePayer = setTransactionMessageFeePayer(
      oldPayer,
      createTransactionMessage({ version: 1 }),
    );
    const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
      { blockhash: BLOCKHASH, lastValidBlockHeight: 1000n },
      withFeePayer,
    );
    const withInstructions = appendTransactionMessageInstructions(
      [
        {
          programAddress: program,
          accounts: [{ address: recipient, role: WRITABLE }],
          data: new Uint8Array([2, 0, 0, 0, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0]),
        },
      ],
      withLifetime,
    );
    return new Uint8Array(
      getCompiledTransactionMessageEncoder().encode(
        compileTransactionMessage(withInstructions),
      ),
    );
  }

  function ataTransferMessageBytes(
    tokenProgram: Address,
    oldAta: Address,
    mint: Address,
  ): Uint8Array {
    const withFeePayer = setTransactionMessageFeePayer(
      oldPayer,
      createTransactionMessage({ version: 1 }),
    );
    const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
      { blockhash: BLOCKHASH, lastValidBlockHeight: 1000n },
      withFeePayer,
    );
    const withInstructions = appendTransactionMessageInstructions(
      [
        {
          programAddress: tokenProgram,
          accounts: [
            { address: oldAta, role: WRITABLE },
            { address: mint, role: 0 },
            { address: oldPayer, role: 3 },
          ],
          data: new Uint8Array([3, 0, 0, 0, 0, 0, 0, 0, 0]),
        },
      ],
      withLifetime,
    );
    return new Uint8Array(
      getCompiledTransactionMessageEncoder().encode(
        compileTransactionMessage(withInstructions),
      ),
    );
  }

  describe("auto-detect mode", () => {
    it("should replace the payer in a v1 message", () => {
      const crafted = craft(toBase64(transferMessageBytes()), {
        payer: newPayer,
      });

      expect(crafted.feePayer.address).toBe(newPayer);
    });

    it("should preserve the recipient and the blockhash", () => {
      const crafted = craft(toBase64(transferMessageBytes()), {
        payer: newPayer,
      });

      const accounts = crafted.instructions.flatMap(
        (ix) => ix.accounts?.map((a) => a.address) ?? [],
      );
      expect(accounts).toContain(recipient);
      // These fixtures always use a blockhash lifetime, never a durable nonce.
      expect(
        (crafted.lifetimeConstraint as { blockhash: typeof BLOCKHASH })
          .blockhash,
      ).toBe(BLOCKHASH);
    });

    it("should re-point the old payer's ATA to the new payer's ATA", () => {
      const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      const mintKey = new PublicKey(mint);
      const oldAta = getAssociatedTokenAddressSync(
        mintKey,
        new PublicKey(oldPayer),
        true,
        TOKEN_PROGRAM_ID,
      );
      const newAta = getAssociatedTokenAddressSync(
        mintKey,
        new PublicKey(newPayer),
        true,
        TOKEN_PROGRAM_ID,
      );

      const bytes = ataTransferMessageBytes(
        TOKEN_PROGRAM_ADDRESS,
        address(oldAta.toBase58()),
        mint,
      );
      const crafted = craft(toBase64(bytes), { payer: newPayer });

      const accounts = crafted.instructions.flatMap(
        (ix) => ix.accounts?.map((a) => a.address) ?? [],
      );
      expect(accounts).toContain(address(newAta.toBase58()));
      expect(accounts).not.toContain(address(oldAta.toBase58()));
      expect(accounts).toContain(mint);
    });

    it("should re-point a TOKEN-2022 ATA", () => {
      const mint = address("9BcWFP4iAFmyT7QkpfRsTm6qkAxqYjZpFMDxZuTGZ6e9");
      const mintKey = new PublicKey(mint);
      const oldAta = getAssociatedTokenAddressSync(
        mintKey,
        new PublicKey(oldPayer),
        true,
        TOKEN_2022_PROGRAM_ID,
      );
      const newAta = getAssociatedTokenAddressSync(
        mintKey,
        new PublicKey(newPayer),
        true,
        TOKEN_2022_PROGRAM_ID,
      );

      const bytes = ataTransferMessageBytes(
        TOKEN_2022_PROGRAM_ADDRESS,
        address(oldAta.toBase58()),
        mint,
      );
      const crafted = craft(toBase64(bytes), { payer: newPayer });

      const accounts = crafted.instructions.flatMap(
        (ix) => ix.accounts?.map((a) => a.address) ?? [],
      );
      expect(accounts).toContain(address(newAta.toBase58()));
      expect(accounts).not.toContain(address(oldAta.toBase58()));
    });

    it("should be idempotent when payer is unchanged", () => {
      const crafted = craft(toBase64(transferMessageBytes()), {
        payer: oldPayer,
      });

      expect(crafted.feePayer.address).toBe(oldPayer);
    });
  });

  describe("round-trip", () => {
    it("should reproduce the message when there are no replacements", () => {
      const original = transferMessageBytes();

      const crafted = craft(toBase64(original), {});

      expect(crafted.feePayer.address).toBe(oldPayer);
      const accounts = crafted.instructions.flatMap(
        (ix) => ix.accounts?.map((a) => a.address) ?? [],
      );
      expect(accounts).toContain(recipient);
    });
  });

  describe("explicit-map mode", () => {
    it("should let explicit pairs override auto-detect entries", () => {
      const explicitPayer = address(
        "8Jz1i4dPUTt3nvzM4RmoAqAVFwyZgtcs2R5DXqfWjfiN",
      );

      const crafted = craft(toBase64(transferMessageBytes()), {
        payer: newPayer,
        replacements: new Map([[oldPayer, explicitPayer]]),
      });

      expect(crafted.feePayer.address).toBe(explicitPayer);
    });

    it("should apply a replacement whose key has surrounding whitespace", () => {
      const crafted = craft(toBase64(transferMessageBytes()), {
        replacements: new Map([[`  ${oldPayer}  `, newPayer]]),
      });

      expect(crafted.feePayer.address).toBe(newPayer);
    });
  });

  describe("full transaction input", () => {
    it("should drop signatures and emit the crafted message", () => {
      const message = transferMessageBytes();
      const withTrailingSignature = new Uint8Array(message.length + 64);
      withTrailingSignature.set(message, 0);
      withTrailingSignature.fill(0xab, message.length);

      const crafted = craft(toBase64(withTrailingSignature), {
        payer: newPayer,
      });

      expect(crafted.feePayer.address).toBe(newPayer);
    });
  });

  describe("errors", () => {
    it("should throw for invalid base64 input", () => {
      expect(() =>
        crafter.getCraftedTransaction("!!!not base64!!!", {}),
      ).toThrow("Input is not a valid base64 string.");
    });

    it("should throw for an invalid base58 payer key", () => {
      expect(() =>
        crafter.getCraftedTransaction(toBase64(transferMessageBytes()), {
          payer: "not-a-valid-key",
        }),
      ).toThrow("Failed to decode public key from base58.");
    });

    it("should throw for garbage binary input", () => {
      const garbage = toBase64(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
      expect(() => crafter.getCraftedTransaction(garbage, {})).toThrow();
    });

    it("should throw when the crafted message exceeds the 4096-byte v1 cap", () => {
      const withFeePayer = setTransactionMessageFeePayer(
        oldPayer,
        createTransactionMessage({ version: 1 }),
      );
      const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: BLOCKHASH, lastValidBlockHeight: 1000n },
        withFeePayer,
      );
      const withInstructions = appendTransactionMessageInstructions(
        [
          {
            programAddress: program,
            accounts: [{ address: recipient, role: WRITABLE }],
            // Comfortably over the 4096-byte v1 cap on its own.
            data: new Uint8Array(4200),
          },
        ],
        withLifetime,
      );
      const oversized = new Uint8Array(
        getCompiledTransactionMessageEncoder().encode(
          compileTransactionMessage(withInstructions),
        ),
      );

      expect(() =>
        crafter.getCraftedTransaction(toBase64(oversized), {
          payer: newPayer,
        }),
      ).toThrow(/over the 4096-byte limit/);
    });
  });
});
