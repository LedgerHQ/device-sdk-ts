import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type BtcLegacyErrorCodes,
  type LegacyCreateTransactionArg,
  type LegacyTransaction,
  type SignerBtcLegacy,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";
import { injectable } from "inversify";

import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import {
  type SigningService,
  type SigningServiceResult,
} from "@root/src/domain/services/SigningService";

/** {@link LegacyTransaction} as a fixture writes it, with hex strings for bytes. */
type HexTransaction = {
  version: string;
  inputs: { prevout: string; script: string; sequence: string }[];
  outputs?: { amount: string; script: string }[];
  locktime?: string;
};

/** {@link LegacyCreateTransactionArg} as a fixture writes it. */
type HexCreateTransactionArg = Omit<LegacyCreateTransactionArg, "inputs"> & {
  inputs: [
    HexTransaction,
    number,
    (string | null)?,
    (number | null)?,
    (number | null)?,
  ][];
};

const bytes = (hex: string): Uint8Array => {
  const buffer = hexaStringToBuffer(hex);
  if (!buffer) {
    throw new Error(`Invalid hex in transaction: ${hex}`);
  }
  return buffer;
};

const toTransaction = (tx: HexTransaction): LegacyTransaction => ({
  version: bytes(tx.version),
  inputs: tx.inputs.map((input) => ({
    prevout: bytes(input.prevout),
    script: bytes(input.script),
    sequence: bytes(input.sequence),
  })),
  outputs: tx.outputs?.map((output) => ({
    amount: bytes(output.amount),
    script: bytes(output.script),
  })),
  locktime: tx.locktime === undefined ? undefined : bytes(tx.locktime),
});

const toCreateTransactionArg = (
  arg: HexCreateTransactionArg,
): LegacyCreateTransactionArg => ({
  ...arg,
  inputs: arg.inputs.map(([transaction, ...rest]) => [
    toTransaction(transaction),
    ...rest,
  ]),
});

/**
 * Legacy Bitcoin signing service, for every coin app on the protocol. Each
 * case names its inputs' paths, so the run's derivation path goes unused.
 */
@injectable()
export class BtcLegacySigningService implements SigningService {
  private signer: SignerBtcLegacy<BtcLegacyErrorCodes> | null = null;

  setSigner(signer: SignerBtcLegacy<BtcLegacyErrorCodes>): void {
    this.signer = signer;
  }

  sign(input: SignableInput): SigningServiceResult {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call setSigner() first.");
    }

    switch (input.kind) {
      case SignableInputKind.Transaction: {
        const transaction = toCreateTransactionArg(
          JSON.parse(input.rawTx) as HexCreateTransactionArg,
        );
        // The app is already open, but skipping OpenApp leaves the signing
        // state as the action's only pending one, emitted synchronously before
        // DMK's intent queue forwards anything, so it would never arrive.
        return this.signer.signTransaction(transaction, {
          skipOpenApp: false,
        }) as SigningServiceResult;
      }
      case SignableInputKind.TypedData:
        throw new Error(
          "TypedData signing is not supported for legacy Bitcoin apps. Only transaction signing is available.",
        );
    }
  }
}
