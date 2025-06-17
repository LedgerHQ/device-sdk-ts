/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as splToken from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { type Mock } from "vitest";

import {
  SolanaTransactionTypes,
  TransactionInspector,
} from "./TransactionInspector";

vi.mock("@solana/spl-token", async () => {
  const actual = await vi.importActual<any>("@solana/spl-token");
  return {
    ...actual,
    getAssociatedTokenAddress: vi.fn(),
  };
});

describe("TransactionInspector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns STANDARD when no SPL instructions are found", async () => {
    // given
    const inspector = new TransactionInspector("somethingSomething");

    vi.spyOn(inspector as any, "parseToVersionedMessage").mockReturnValue({
      compiledInstructions: [],
      staticAccountKeys: [],
    });

    // when
    const result = await inspector.run();

    // then
    expect(result).toEqual({
      transactionType: SolanaTransactionTypes.STANDARD,
      data: {},
    });
  });

  it("detects SPL + already existing ATA and returns tokenAddress", async () => {
    // given
    const mintPk = Keypair.generate().publicKey;
    const authPk = Keypair.generate().publicKey;
    const ataPk = Keypair.generate().publicKey;

    (splToken.getAssociatedTokenAddress as Mock).mockResolvedValue(ataPk);

    const inspector = new TransactionInspector("somethingSomething");

    vi.spyOn(inspector as any, "parseToVersionedMessage").mockReturnValue({
      compiledInstructions: [
        { programIdIndex: 0, accountKeyIndexes: [], data: new Uint8Array() },
      ],
      staticAccountKeys: [
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      ],
    });
    vi.spyOn(inspector as any, "decodeSplInstruction").mockReturnValue({
      mint: mintPk.toBase58(),
      authority: authPk.toBase58(),
      source: ataPk.toBase58(),
      destination: ataPk.toBase58(),
    });

    // when
    const result = await inspector.run();

    // then
    expect(result).toEqual({
      transactionType: SolanaTransactionTypes.SPL,
      data: { tokenAddress: ataPk.toBase58() },
    });
  });

  it("detects SPL + missing ATA and returns createATA", async () => {
    // given
    const mintPk = Keypair.generate().publicKey;
    const authPk = Keypair.generate().publicKey;
    const ataPk = Keypair.generate().publicKey;
    const otherAccount = Keypair.generate().publicKey;

    (splToken.getAssociatedTokenAddress as Mock).mockResolvedValue(ataPk);

    const inspector = new TransactionInspector("somethingSomething");

    vi.spyOn(inspector as any, "parseToVersionedMessage").mockReturnValue({
      compiledInstructions: [
        { programIdIndex: 0, accountKeyIndexes: [], data: new Uint8Array() },
      ],
      staticAccountKeys: [
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      ],
    });
    vi.spyOn(inspector as any, "decodeSplInstruction").mockReturnValue({
      mint: mintPk.toBase58(),
      authority: authPk.toBase58(),
      source: otherAccount.toBase58(),
    });

    // when
    const result = await inspector.run();

    // then
    expect(result).toEqual({
      transactionType: SolanaTransactionTypes.SPL,
      data: {
        createATA: {
          address: ataPk.toBase58(),
          mintAddress: mintPk.toBase58(),
        },
      },
    });
  });
});
