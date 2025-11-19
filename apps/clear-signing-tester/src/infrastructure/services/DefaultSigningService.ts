import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  SignerEth,
  type TypedData,
} from "@ledgerhq/device-signer-kit-ethereum";
import { injectable } from "inversify";

import {
  type SigningService,
  type SigningServiceResult,
} from "@root/src/domain/services/SigningService";

@injectable()
export class DefaultSigningService implements SigningService {
  private signer: SignerEth | null = null;

  constructor() {}

  setSigner(signer: SignerEth): void {
    this.signer = signer;
  }

  signTransaction(
    derivationPath: string,
    transaction: string,
  ): SigningServiceResult {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call initialize() first.");
    }

    const rawTx = hexaStringToBuffer(transaction);
    if (!rawTx) {
      throw new Error("Invalid transaction format");
    }

    return this.signer.signTransaction(derivationPath, rawTx, {
      skipOpenApp: true,
    }) as SigningServiceResult;
  }

  signTypedData(
    derivationPath: string,
    typedData: string,
  ): SigningServiceResult {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call initialize() first.");
    }

    const rawTypedData = JSON.parse(typedData) as TypedData;

    if (!rawTypedData) {
      throw new Error("Invalid typed data format");
    }

    return this.signer.signTypedData(derivationPath, rawTypedData, {
      skipOpenApp: true,
    }) as SigningServiceResult;
  }
}
