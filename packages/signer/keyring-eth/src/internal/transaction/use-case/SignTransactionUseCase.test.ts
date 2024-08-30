import { Transaction } from "ethers-v6";

import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  it("should call signTransaction on appBinder with the correct arguments", () => {
    // Given
    const derivationPath = "m/44'/60'/0'/0/0";
    const transaction: Transaction = new Transaction();
    transaction.to = "0x1234567890123456789012345678901234567890";
    transaction.value = 0n;
    transaction.data = "0x";
    const appBinder: EthAppBinder = {
      signTransaction: jest.fn(),
    } as unknown as EthAppBinder;
    const useCase = new SignTransactionUseCase(appBinder);

    // When
    useCase.execute(derivationPath, transaction);

    // Then
    expect(appBinder.signTransaction).toHaveBeenCalledWith({
      derivationPath,
      transaction,
    });
  });
});
