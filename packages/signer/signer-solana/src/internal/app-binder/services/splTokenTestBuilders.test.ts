import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { TOKEN_2022_PROGRAM_ID } from "@internal/app-binder/services/utils/splToken";

import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeAccount2Instruction,
  createInitializeAccount3Instruction,
  createInitializeAccountInstruction,
  createSyncNativeInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
} from "./splTokenTestBuilders";

// Golden byte-vectors captured from `@solana/spl-token@0.4.13`'s real builders
// (deterministic pubkeys below), locking the inlined builders to the SPL wire
// format without depending on the package.
type GoldenIx = {
  programId: string;
  keys: [string, number, number][];
  data: string;
};

// Deterministic pubkeys: a 32-byte buffer filled with the given byte.
const pk = (fill: number) => new PublicKey(new Uint8Array(32).fill(fill));
const A = pk(1); // source / account / payer
const B = pk(2); // destination
const OWNER = pk(5);
const MINT = pk(6);
const S1 = pk(7); // multisig signer
const S2 = pk(8); // multisig signer

const GOLDEN = {
  transfer: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 1, 0],
    ],
    data: "032a00000000000000",
  },
  transferMulti: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 0, 0],
      ["US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx", 1, 0],
      ["YMN9Qj5jPNp7j14VPcML1B6xGgcPWVZUGLFU3Mnyfaf", 1, 0],
    ],
    data: "032a00000000000000",
  },
  transferChecked: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["QWmroo4YnnMqYW3cnxWkFdaTxGD3P7vMSzwMHGbUzwF", 0, 0],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 1, 0],
    ],
    data: "0c7b0000000000000006",
  },
  transferCheckedMulti: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["QWmroo4YnnMqYW3cnxWkFdaTxGD3P7vMSzwMHGbUzwF", 0, 0],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 0, 0],
      ["US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx", 1, 0],
      ["YMN9Qj5jPNp7j14VPcML1B6xGgcPWVZUGLFU3Mnyfaf", 1, 0],
    ],
    data: "0c7b0000000000000006",
  },
  initAccount: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["QWmroo4YnnMqYW3cnxWkFdaTxGD3P7vMSzwMHGbUzwF", 0, 0],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 0, 0],
      ["SysvarRent111111111111111111111111111111111", 0, 0],
    ],
    data: "01",
  },
  initAccount2: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["QWmroo4YnnMqYW3cnxWkFdaTxGD3P7vMSzwMHGbUzwF", 0, 0],
      ["SysvarRent111111111111111111111111111111111", 0, 0],
    ],
    data: "100505050505050505050505050505050505050505050505050505050505050505",
  },
  initAccount3: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["QWmroo4YnnMqYW3cnxWkFdaTxGD3P7vMSzwMHGbUzwF", 0, 0],
    ],
    data: "120505050505050505050505050505050505050505050505050505050505050505",
  },
  ataClassic: {
    programId: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 1, 1],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 0, 0],
      ["QWmroo4YnnMqYW3cnxWkFdaTxGD3P7vMSzwMHGbUzwF", 0, 0],
      ["11111111111111111111111111111111", 0, 0],
      ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", 0, 0],
    ],
    data: "",
  },
  ata2022: {
    programId: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 1, 1],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 0, 0],
      ["QWmroo4YnnMqYW3cnxWkFdaTxGD3P7vMSzwMHGbUzwF", 0, 0],
      ["11111111111111111111111111111111", 0, 0],
      ["TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", 0, 0],
    ],
    data: "",
  },
  closeAccount: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 1, 0],
    ],
    data: "09",
  },
  closeAccountMulti: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [
      ["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1],
      ["8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR", 0, 1],
      ["LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY", 0, 0],
      ["US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx", 1, 0],
      ["YMN9Qj5jPNp7j14VPcML1B6xGgcPWVZUGLFU3Mnyfaf", 1, 0],
    ],
    data: "09",
  },
  syncNative: {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    keys: [["4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi", 0, 1]],
    data: "11",
  },
} satisfies Record<string, GoldenIx>;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function expectMatches(
  ix: {
    programId: PublicKey;
    keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
    data: Uint8Array;
  },
  golden: GoldenIx,
) {
  expect(ix.programId.toBase58()).toBe(golden.programId);
  expect(
    ix.keys.map((k) => [
      k.pubkey.toBase58(),
      k.isSigner ? 1 : 0,
      k.isWritable ? 1 : 0,
    ]),
  ).toEqual(golden.keys);
  expect(toHex(ix.data)).toBe(golden.data);
}

describe("inlined SPL Token builders match @solana/spl-token golden vectors", () => {
  it("createTransferInstruction", () => {
    expectMatches(
      createTransferInstruction(A, B, OWNER, 42n, []),
      GOLDEN.transfer,
    );
    expectMatches(
      createTransferInstruction(A, B, OWNER, 42n, [S1, S2]),
      GOLDEN.transferMulti,
    );
  });

  it("createTransferCheckedInstruction", () => {
    expectMatches(
      createTransferCheckedInstruction(A, MINT, B, OWNER, 123n, 6, []),
      GOLDEN.transferChecked,
    );
    expectMatches(
      createTransferCheckedInstruction(A, MINT, B, OWNER, 123n, 6, [S1, S2]),
      GOLDEN.transferCheckedMulti,
    );
  });

  it("createInitializeAccountInstruction", () => {
    expectMatches(
      createInitializeAccountInstruction(A, MINT, OWNER),
      GOLDEN.initAccount,
    );
  });

  it("createInitializeAccount2Instruction", () => {
    expectMatches(
      createInitializeAccount2Instruction(A, MINT, OWNER),
      GOLDEN.initAccount2,
    );
  });

  it("createInitializeAccount3Instruction", () => {
    expectMatches(
      createInitializeAccount3Instruction(A, MINT, OWNER),
      GOLDEN.initAccount3,
    );
  });

  it("createAssociatedTokenAccountInstruction", () => {
    expectMatches(
      createAssociatedTokenAccountInstruction(A, B, OWNER, MINT),
      GOLDEN.ataClassic,
    );
    expectMatches(
      createAssociatedTokenAccountInstruction(
        A,
        B,
        OWNER,
        MINT,
        TOKEN_2022_PROGRAM_ID,
      ),
      GOLDEN.ata2022,
    );
  });

  it("createCloseAccountInstruction", () => {
    expectMatches(
      createCloseAccountInstruction(A, B, OWNER, []),
      GOLDEN.closeAccount,
    );
    expectMatches(
      createCloseAccountInstruction(A, B, OWNER, [S1, S2]),
      GOLDEN.closeAccountMulti,
    );
  });

  it("createSyncNativeInstruction", () => {
    expectMatches(createSyncNativeInstruction(A), GOLDEN.syncNative);
  });
});
