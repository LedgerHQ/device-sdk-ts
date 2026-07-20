import { vi } from "vitest";

import { type IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  it("should forward the path and transaction to appBinder.signTransaction", () => {
    // ARRANGE
    const derivationPath = "44'/223'/0'/0/0";
    const transaction = new Uint8Array([0x01, 0x02, 0x03]);
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const signTransactionMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      signTransaction: signTransactionMock,
    } as unknown as IcpAppBinder;
    const useCase = new SignTransactionUseCase(appBinderMock);

    // ACT
    const result = useCase.execute(derivationPath, transaction);

    // ASSERT
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath,
      transaction,
      skipOpenApp: undefined,
    });
    expect(result).toBe(expectedResult);
  });
});
