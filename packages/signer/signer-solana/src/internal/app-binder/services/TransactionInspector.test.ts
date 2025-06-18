/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as splToken from "@solana/spl-token";
import {
  Keypair,
  type PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  SolanaTransactionTypes,
  TransactionInspector,
} from "./TransactionInspector";

function makeFakeMessage(opts: {
  compiledInstructions: Array<{
    programIdIndex: number;
    accountKeyIndexes: number[];
    data: Uint8Array | number[] | Buffer;
  }>;
  staticAccountKeys: PublicKey[];
}): VersionedMessage {
  return {
    compiledInstructions: opts.compiledInstructions.map((ix) => ({
      ...ix,
      data:
        ix.data instanceof Uint8Array
          ? ix.data
          : typeof Buffer !== "undefined" && ix.data instanceof Buffer
            ? ix.data
            : new Uint8Array(ix.data as number[]),
    })),
    staticAccountKeys: opts.staticAccountKeys,
    isAccountSigner: (_: number) => false,
    isAccountWritable: (_: number) => false,
  } as any;
}

vi.mock("@solana/spl-token", async () => {
  const actual = await vi.importActual<any>("@solana/spl-token");
  return {
    ...actual,
    decodeInstruction: vi.fn(),
    getAssociatedTokenAddress: vi.fn(),
    TOKEN_PROGRAM_ID: actual.TOKEN_PROGRAM_ID,
  };
});
const { decodeInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } =
  splToken as any;

describe("TransactionInspector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns STANDARD when no SPL instructions are found", async () => {
    // given
    const inspector = new TransactionInspector(new Uint8Array());
    vi.spyOn(inspector as any, "extractMessage").mockReturnValue(
      makeFakeMessage({ compiledInstructions: [], staticAccountKeys: [] }),
    );

    // when
    const res = await inspector.inspectTransactionType();

    // then
    expect(res).toEqual({
      transactionType: SolanaTransactionTypes.STANDARD,
      data: {},
    });
  });

  it("ignores instructions not targeting TOKEN_PROGRAM_ID", async () => {
    // given
    const fakePk = Keypair.generate().publicKey;
    const msg = makeFakeMessage({
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1],
          data: new Uint8Array([1]),
        },
      ],
      staticAccountKeys: [fakePk, Keypair.generate().publicKey],
    });
    const inspector = new TransactionInspector(new Uint8Array());
    vi.spyOn(inspector as any, "extractMessage").mockReturnValue(msg);

    // when
    const res = await inspector.inspectTransactionType();

    // then
    expect(res.transactionType).toBe(SolanaTransactionTypes.STANDARD);
  });

  it("skips a first bad decodeInstruction and succeeds on the next", async () => {
    // given
    const dest = Keypair.generate().publicKey;
    const other = Keypair.generate().publicKey;

    const msg = makeFakeMessage({
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [0, 1, 2],
          data: new Uint8Array([0]),
        },
        {
          programIdIndex: 0,
          accountKeyIndexes: [0, 1, 2],
          data: new Uint8Array([0]),
        },
      ],
      staticAccountKeys: [TOKEN_PROGRAM_ID, other, dest],
    });
    const inspector = new TransactionInspector(new Uint8Array());
    vi.spyOn(inspector as any, "extractMessage").mockReturnValue(msg);

    decodeInstruction
      .mockReturnValueOnce(new Error("bad"))
      .mockReturnValueOnce({ data: { amount: 7 } });

    // when
    const res = await inspector.inspectTransactionType();

    // then
    expect(res).toEqual({
      transactionType: SolanaTransactionTypes.SPL,
      data: { tokenAddress: dest.toBase58() },
    });
  });

  it("converts Buffer or number[] data into Uint8Array before decoding", async () => {
    // given
    const dest = Keypair.generate().publicKey;
    const other = Keypair.generate().publicKey;
    const msg = makeFakeMessage({
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [0, 1, 2],
          data: Buffer.from([5, 6, 7]),
        },
        { programIdIndex: 0, accountKeyIndexes: [0, 1, 2], data: [8, 9, 10] },
      ],
      staticAccountKeys: [TOKEN_PROGRAM_ID, other, dest],
    });
    const inspector = new TransactionInspector(new Uint8Array());
    vi.spyOn(inspector as any, "extractMessage").mockReturnValue(msg);

    decodeInstruction
      .mockReturnValueOnce(new Error("nope"))
      .mockImplementation((ix: TransactionInstruction) => {
        expect(ix.data).toBeInstanceOf(Uint8Array);
        return { data: { amount: 21 } };
      });

    // when
    const res = await inspector.inspectTransactionType();

    // then
    expect(res.data).toEqual({ tokenAddress: dest.toBase58() });
  });

  it("detects TransferChecked with existing ATA", async () => {
    // given
    const mint = Keypair.generate().publicKey;
    const auth = Keypair.generate().publicKey;
    const ata = Keypair.generate().publicKey;
    getAssociatedTokenAddress.mockResolvedValue(ata);

    const msg = makeFakeMessage({
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1, 2, 3, 4],
          data: new Uint8Array([3]),
        },
      ],
      staticAccountKeys: [TOKEN_PROGRAM_ID, auth, ata, ata, mint],
    });
    const inspector = new TransactionInspector(new Uint8Array());
    vi.spyOn(inspector as any, "extractMessage").mockReturnValue(msg);

    decodeInstruction.mockReturnValue({
      data: { mint, authority: auth, source: ata, destination: ata },
    });

    // when
    const res = await inspector.inspectTransactionType();

    // then
    expect(res).toEqual({
      transactionType: SolanaTransactionTypes.SPL,
      data: { tokenAddress: ata.toBase58() },
    });
  });

  it("detects TransferChecked without existing ATA ⇒ createATA", async () => {
    // given
    const mint = Keypair.generate().publicKey;
    const auth = Keypair.generate().publicKey;
    const ata = Keypair.generate().publicKey;
    const other = Keypair.generate().publicKey;
    getAssociatedTokenAddress.mockResolvedValue(ata);

    const msg = makeFakeMessage({
      compiledInstructions: [
        {
          programIdIndex: 0,
          accountKeyIndexes: [1, 2, 3, 4],
          data: new Uint8Array([3]),
        },
      ],
      staticAccountKeys: [TOKEN_PROGRAM_ID, auth, other, other, mint],
    });
    const inspector = new TransactionInspector(new Uint8Array());
    vi.spyOn(inspector as any, "extractMessage").mockReturnValue(msg);

    decodeInstruction.mockReturnValue({
      data: { mint, authority: auth, source: other, destination: other },
    });

    // when
    const res = await inspector.inspectTransactionType();

    // then
    expect(res).toEqual({
      transactionType: SolanaTransactionTypes.SPL,
      data: {
        createATA: {
          address: ata.toBase58(),
          mintAddress: mint.toBase58(),
        },
      },
    });
  });

  it("extractMessage: throws combined error if all three deserializers fail", () => {
    // given
    vi.spyOn(VersionedTransaction, "deserialize").mockImplementation(() => {
      throw new Error("vtx fail");
    });
    vi.spyOn(VersionedMessage, "deserialize").mockImplementation(() => {
      throw new Error("vmd fail");
    });
    vi.spyOn(Transaction, "from").mockImplementation(() => {
      throw new Error("tx fail");
    });

    // when
    const inspector = new TransactionInspector(new Uint8Array([0x01, 0x02]));

    // then
    expect(() =>
      (inspector as any).extractMessage(new Uint8Array([0x01, 0x02])),
    ).toThrow(
      /Invalid transaction payload[\s\S]*1\) vtx fail[\s\S]*2\) vmd fail[\s\S]*3\) tx fail/,
    );
  });

  it("returns STANDARD fallback when all deserialisers throw", async () => {
    vi.spyOn(VersionedTransaction, "deserialize").mockImplementation(() => {
      throw new Error("vtx fail");
    });
    vi.spyOn(VersionedMessage, "deserialize").mockImplementation(() => {
      throw new Error("vmd fail");
    });
    vi.spyOn(Transaction, "from").mockImplementation(() => {
      throw new Error("tx fail");
    });

    const inspector = new TransactionInspector(
      new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    );
    const result = await inspector.inspectTransactionType();

    expect(result).toEqual({
      transactionType: SolanaTransactionTypes.STANDARD,
      data: {},
    });
  });
});

describe("isTransferCheckedData", () => {
  const inspector = new TransactionInspector(new Uint8Array());

  it("returns false for null or primitive values", () => {
    expect((inspector as any).isTransferCheckedData(null)).toBe(false);
    expect((inspector as any).isTransferCheckedData(42)).toBe(false);
    expect((inspector as any).isTransferCheckedData("string")).toBe(false);
  });

  it("returns false for objects missing required keys or wrong types", () => {
    // given
    const fakePk = Keypair.generate().publicKey;

    // when / then
    // Missing keys
    expect(
      (inspector as any).isTransferCheckedData({
        mint: fakePk,
        authority: fakePk,
      }),
    ).toBe(false);
    // Wrong types
    expect(
      (inspector as any).isTransferCheckedData({
        mint: "nope",
        authority: null,
        source: {},
        destination: [],
      }),
    ).toBe(false);
  });

  it("returns true for a properly shaped object", () => {
    // given
    const fakePk = Keypair.generate().publicKey;
    const data = {
      mint: fakePk,
      authority: fakePk,
      source: fakePk,
      destination: fakePk,
    };

    // when / then
    expect((inspector as any).isTransferCheckedData(data)).toBe(true);
  });
});

describe("extractMessage legacy fallback", () => {
  it("handles a legacy Transaction via serializeMessage and returns STANDARD", async () => {
    // given
    vi.spyOn(VersionedTransaction, "deserialize").mockImplementation(() => {
      throw new Error("vtx fail");
    });
    vi.spyOn(VersionedMessage, "deserialize").mockImplementation(() => {
      throw new Error("vmd fail");
    });

    const from = Keypair.generate();
    const to = Keypair.generate();
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to.publicKey,
        lamports: 1,
      }),
    );
    tx.feePayer = from.publicKey;
    tx.recentBlockhash = "11111111111111111111111111111111";

    tx.sign(from);

    const raw = tx.serialize();

    // when
    const result = await new TransactionInspector(raw).inspectTransactionType();

    // then
    expect(result.transactionType).toBe("Standard");
    expect(result.data).toEqual({});
  });
});
