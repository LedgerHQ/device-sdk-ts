import { address } from "@solana/addresses";
import { blockhash } from "@solana/rpc-types";
import {
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createTransactionMessage,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/transaction-messages";

// AccountRole.WRITABLE (from @solana/instructions: READONLY=0, WRITABLE=1,
// READONLY_SIGNER=2, WRITABLE_SIGNER=3).
const WRITABLE_ROLE = 1;

export const V1_FEE_PAYER = address(
  "2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB",
);
const recipient = address("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");
export const V1_PROGRAM = address("11111111111111111111111111111111");
const recentBlockhash = blockhash(
  "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg",
);

/** A bare v1 (SIMD-0385) message with one System Program instruction. */
export function buildV1MessageBytes(): Uint8Array {
  const withFeePayer = setTransactionMessageFeePayer(
    V1_FEE_PAYER,
    createTransactionMessage({ version: 1 }),
  );
  const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
    { blockhash: recentBlockhash, lastValidBlockHeight: 1000n },
    withFeePayer,
  );
  const withInstructions = appendTransactionMessageInstructions(
    [
      {
        programAddress: V1_PROGRAM,
        accounts: [{ address: recipient, role: WRITABLE_ROLE }],
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
