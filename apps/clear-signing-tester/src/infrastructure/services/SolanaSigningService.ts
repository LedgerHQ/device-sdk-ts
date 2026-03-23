import { type SignerSolana } from "@ledgerhq/device-signer-kit-solana";
import { injectable } from "inversify";

import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import {
  type SigningService,
  type SigningServiceResult,
} from "@root/src/domain/services/SigningService";

/** Solana signing service. Handles transaction signing only. */
@injectable()
export class SolanaSigningService implements SigningService {
  private signer: SignerSolana | null = null;

  constructor() {}

  setSigner(signer: SignerSolana): void {
    this.signer = signer;
  }

  sign(input: SignableInput, derivationPath: string): SigningServiceResult {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call setSigner() first.");
    }

    switch (input.kind) {
      case SignableInputKind.Transaction: {
        const txBytes = base64ToUint8Array(input.rawTx);
        return this.signer.signTransaction(derivationPath, txBytes, {
          skipOpenApp: true,
        }) as SigningServiceResult;
      }
      case SignableInputKind.TypedData:
        throw new Error(
          "TypedData signing is not supported for Solana. Only transaction signing is available.",
        );
    }
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
