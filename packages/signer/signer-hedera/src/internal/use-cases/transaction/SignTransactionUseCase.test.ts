import { vi } from "vitest";

import { type HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  const transactionBody = new Uint8Array([0x01, 0x02, 0x03]);

  const makeUseCase = (signTransactionMock: ReturnType<typeof vi.fn>) =>
    new SignTransactionUseCase({
      signTransaction: signTransactionMock,
    } as unknown as HederaAppBinder);

  it("should forward the key index, body and default options to appBinder.signTransaction", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const signTransactionMock = vi.fn().mockReturnValue(expectedResult);
    const useCase = makeUseCase(signTransactionMock);

    // ACT
    const result = useCase.execute(0, transactionBody);

    // ASSERT
    expect(signTransactionMock).toHaveBeenCalledWith({
      keyIndex: 0,
      transactionBody,
      skipOpenApp: false,
    });
    expect(result).toBe(expectedResult);
  });

  it("should forward provided options", () => {
    // ARRANGE
    const signTransactionMock = vi.fn().mockReturnValue({});
    const useCase = makeUseCase(signTransactionMock);

    // ACT
    useCase.execute(0, transactionBody, { skipOpenApp: true });

    // ASSERT
    expect(signTransactionMock).toHaveBeenCalledWith({
      keyIndex: 0,
      transactionBody,
      skipOpenApp: true,
    });
  });

  it("should refuse a transaction larger than one APDU without reaching the device", () => {
    // ARRANGE
    const signTransactionMock = vi.fn();
    const useCase = makeUseCase(signTransactionMock);

    // ACT & ASSERT
    expect(() => useCase.execute(0, new Uint8Array(252))).toThrow(
      "Hedera transaction is 252 bytes, the device accepts at most 251",
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("should throw on an invalid key index without reaching the device", () => {
    // ARRANGE
    const signTransactionMock = vi.fn();
    const useCase = makeUseCase(signTransactionMock);

    // ACT & ASSERT
    expect(() => useCase.execute(1.5, transactionBody)).toThrow(
      "Invalid Hedera key index",
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
  });
});
