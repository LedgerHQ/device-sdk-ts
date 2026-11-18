import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  findProgramAddressSync,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./splToken";

// Vectors computed with @solana/web3.js 1.98.2 `findProgramAddressSync` and
// cross-checked with 3.2.1's async `findProgramAddress`.
const OWNER = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const PYUSD = new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");
// A token account is a PDA, so it is off the ed25519 curve.
const OFF_CURVE_OWNER = new PublicKey(
  "FGETo8T8wMcN2wCjav8VK6eh3dLk63evNDPxzLSJra8B",
);

describe("getAssociatedTokenAddressSync", () => {
  it("derives the classic token account", () => {
    expect(getAssociatedTokenAddressSync(USDC, OWNER).toBase58()).toBe(
      "FGETo8T8wMcN2wCjav8VK6eh3dLk63evNDPxzLSJra8B",
    );
  });

  it("derives the Token-2022 account", () => {
    expect(
      getAssociatedTokenAddressSync(
        PYUSD,
        OWNER,
        false,
        TOKEN_2022_PROGRAM_ID,
      ).toBase58(),
    ).toBe("897krAvWH3RbymaCYE3o9emopUwocieHuKTUk9nySpq6");
  });

  it("derives for an off-curve owner when allowed", () => {
    expect(
      getAssociatedTokenAddressSync(USDC, OFF_CURVE_OWNER, true).toBase58(),
    ).toBe("2f3HJSJdAY3NFcN7DYnNm9xax2ZnXGh4VuLRRjBNq9Ag");
  });

  it("throws for an off-curve owner by default", () => {
    expect(() => getAssociatedTokenAddressSync(USDC, OFF_CURVE_OWNER)).toThrow(
      "TokenOwnerOffCurveError",
    );
  });
});

describe("findProgramAddressSync", () => {
  it("returns the first off-curve bump counting down from 255", () => {
    const [address, bump] = findProgramAddressSync(
      [OWNER.toBytes(), TOKEN_PROGRAM_ID.toBytes(), USDC.toBytes()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    expect(address.toBase58()).toBe(
      "FGETo8T8wMcN2wCjav8VK6eh3dLk63evNDPxzLSJra8B",
    );
    expect(bump).toBe(254);
  });
});
