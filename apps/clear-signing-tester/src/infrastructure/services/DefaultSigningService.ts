import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  SignerEth,
  type TypedData,
} from "@ledgerhq/device-signer-kit-ethereum";
import { injectable } from "inversify";

import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import {
  type SigningService,
  type SigningServiceResult,
} from "@root/src/domain/services/SigningService";

/** Ethereum signing service. Handles both transactions and EIP-712 typed data. */
@injectable()
export class DefaultSigningService implements SigningService {
  private signer: SignerEth | null = null;

  constructor() {}

  setSigner(signer: SignerEth): void {
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
      case SignableInputKind.TypedData: {
        const rawTypedData = JSON.parse(input.data) as TypedData;
        if (!rawTypedData) {
          throw new Error("Invalid typed data format");
        }
        return this.signer.signTypedData(derivationPath, rawTypedData, {
          skipOpenApp: true,
        }) as SigningServiceResult;
      }
    }
  }
}
