/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

vi.mock("@solana/spl-token", async () => {
  const actual = await vi.importActual<any>("@solana/spl-token");
  return {
    ...actual,
    getAssociatedTokenAddress: vi.fn(),
  };
});

import { ComputeAssociatedTokenAccountAddress } from "./ComputeAssociatedTokenAccountAddress";

const OWNER = "4Nd1mY37QsdwVQeXq1Q1YHMxZfbwUqT3enhKb2d7J2HR";
const MINT = "So11111111111111111111111111111111111111112";
const ATA = "5eykt4UsFv8P8NJdTREvG13nrEbdnbTQP7uGRrNjaMq6";

describe("ComputeAssociatedTokenAccountAddress", () => {
  let task: ComputeAssociatedTokenAccountAddress;

  beforeEach(() => {
    task = new ComputeAssociatedTokenAccountAddress();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("derives the correct ATA and returns the base58 string", async () => {
    // given
    (getAssociatedTokenAddress as vi.Mock).mockResolvedValue(
      new PublicKey(ATA),
    );

    // when
    const result = await task.run({ ownerAddress: OWNER, mintAddress: MINT });

    // then
    expect(result).toBe(ATA);

    expect(getAssociatedTokenAddress).toHaveBeenCalledTimes(1);
    const [calledMint, calledOwner, allowOffCurve, tp, atp] = (
      getAssociatedTokenAddress as vi.Mock
    ).mock.calls[0];
    expect(calledMint).toBeInstanceOf(PublicKey);
    expect(calledMint.toBase58()).toBe(MINT);
    expect(calledOwner).toBeInstanceOf(PublicKey);
    expect(calledOwner.toBase58()).toBe(OWNER);
    expect(allowOffCurve).toBe(false);
    expect(tp).toBe(TOKEN_PROGRAM_ID);
    expect(atp).toBe(ASSOCIATED_TOKEN_PROGRAM_ID);
  });

  it("propagates errors from getAssociatedTokenAddress", async () => {
    // given
    (getAssociatedTokenAddress as vi.Mock).mockRejectedValue(
      new Error("RPC failure"),
    );

    // then
    await expect(
      task.run({ ownerAddress: OWNER, mintAddress: MINT }),
    ).rejects.toThrow("RPC failure");
  });

  it("throws if ownerAddress is invalid base58", async () => {
    await expect(
      task.run({ ownerAddress: "definitely_not_a_base58", mintAddress: MINT }),
    ).rejects.toThrow();
  });

  it("throws if mintAddress is invalid base58", async () => {
    await expect(
      task.run({
        ownerAddress: OWNER,
        mintAddress: "definitely_not_a_valid_mint",
      }),
    ).rejects.toThrow();
  });
});
