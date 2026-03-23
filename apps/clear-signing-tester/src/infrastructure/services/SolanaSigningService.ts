import { type SignerSolana } from "@ledgerhq/device-signer-kit-solana";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import {
  type SigningService,
  type SigningServiceResult,
} from "@root/src/domain/services/SigningService";
import { TransactionCraftingService } from "@root/src/infrastructure/services/TransactionCraftingService";

/** Solana signing service. Handles transaction signing with optional payer crafting. */
@injectable()
export class SolanaSigningService implements SigningService {
  private signer: SignerSolana | null = null;

  constructor(
    @inject(TYPES.TransactionCraftingService)
    private readonly transactionCraftingService: TransactionCraftingService,
  ) {}

  setSigner(signer: SignerSolana): void {
    this.signer = signer;
  }

  async sign(
    input: SignableInput,
    derivationPath: string,
  ): Promise<SigningServiceResult> {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call setSigner() first.");
    }

    switch (input.kind) {
      case SignableInputKind.Transaction: {
        const rawTx = input.skipCraft
          ? input.rawTx
          : await this.transactionCraftingService.craftForDevice(
              derivationPath,
              input.rawTx,
            );
        const txBytes = base64ToUint8Array(rawTx);
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
