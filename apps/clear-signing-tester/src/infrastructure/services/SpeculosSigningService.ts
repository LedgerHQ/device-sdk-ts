import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { SignerEth } from "@ledgerhq/device-signer-kit-ethereum";
import { ethers } from "ethers";
import { injectable } from "inversify";

@injectable()
export class SpeculosSigningService {
    private signer: SignerEth | null = null;

    constructor() {}

    async setSigner(signer: SignerEth): Promise<void> {
        this.signer = signer;
    }

    signTransaction(derivationPath: string, transaction: string) {
        if (!this.signer) {
            throw new Error("Signer not initialized. Call initialize() first.");
        }

        const unsignedSerializedTx =
            ethers.Transaction.from(transaction).unsignedSerialized;
        const rawTx = hexaStringToBuffer(unsignedSerializedTx);

        if (!rawTx) {
            throw new Error("Invalid transaction format");
        }

        return this.signer.signTransaction(derivationPath, rawTx, {
            skipOpenApp: true,
        });
    }

    signTypedData(derivationPath: string, typedData: string) {
        if (!this.signer) {
            throw new Error("Signer not initialized. Call initialize() first.");
        }

        const rawTypedData = JSON.parse(typedData);

        if (!rawTypedData) {
            throw new Error("Invalid typed data format");
        }

        return this.signer.signTypedData(derivationPath, rawTypedData, {
            skipOpenApp: true,
        });
    }
}
