import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { type SignerTrx } from "@ledgerhq/device-signer-kit-tron";
import { injectable } from "inversify";

import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import {
  type SigningService,
  type SigningServiceResult,
} from "@root/src/domain/services/SigningService";

/** Tron signing service. Signs the protobuf `raw_data` a case carries as hex. */
@injectable()
export class TronSigningService implements SigningService {
  private signer: SignerTrx | null = null;

  setSigner(signer: SignerTrx): void {
    this.signer = signer;
  }

  sign(input: SignableInput, derivationPath: string): SigningServiceResult {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call setSigner() first.");
    }

    switch (input.kind) {
      case SignableInputKind.Transaction: {
        const rawTx = hexaStringToBuffer(input.rawTx);
        if (!rawTx) {
          throw new Error("Invalid transaction format");
        }
        return this.signer.signTransaction(derivationPath, rawTx, {
          skipOpenApp: true,
        }) as SigningServiceResult;
      }
      case SignableInputKind.TypedData:
        throw new Error(
          "TypedData signing is not supported for Tron. Only transaction signing is available.",
        );
    }
  }
}
