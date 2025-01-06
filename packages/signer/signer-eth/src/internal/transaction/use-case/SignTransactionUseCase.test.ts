import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";

import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  it("should call signTransaction on appBinder with the correct arguments", () => {
    // Given
    const derivationPath = "m/44'/60'/0'/0/0";
    const tx: Transaction = new Transaction();
    tx.to = "0x1234567890123456789012345678901234567890";
    tx.value = 0n;
    tx.data = "0x";
    const appBinder: EthAppBinder = {
      signTransaction: jest.fn(),
    } as unknown as EthAppBinder;
    const useCase = new SignTransactionUseCase(appBinder);
    const transaction = hexaStringToBuffer(tx.unsignedSerialized) as Uint8Array;

    // When
    useCase.execute(derivationPath, transaction);

    // Then
    expect(appBinder.signTransaction).toHaveBeenCalledWith({
      derivationPath,
      transaction,
    });
  });
});
