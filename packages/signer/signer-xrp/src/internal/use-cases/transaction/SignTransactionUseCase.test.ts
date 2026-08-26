import { from } from "rxjs";
import { vi } from "vitest";

import { type XrpAppBinder } from "@internal/app-binder/XrpAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

const DERIVATION_PATH = "44'/144'/0'/0/0";
const TRANSACTION = Uint8Array.from([0x12, 0x00, 0x00]);

describe("SignTransactionUseCase", () => {
  const setup = () => {
    const expectedResult = { observable: from([]), cancel: vi.fn() };
    const signTransactionMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      signTransaction: signTransactionMock,
    } as unknown as XrpAppBinder;

    return {
      signTransactionMock,
      expectedResult,
      useCase: new SignTransactionUseCase(appBinderMock),
    };
  };

  it("should return the result from appBinder.signTransaction", () => {
    // GIVEN
    const { useCase, expectedResult } = setup();

    // WHEN
    const result = useCase.execute(DERIVATION_PATH, TRANSACTION);

    // THEN
    expect(result).toBe(expectedResult);
  });

  it("should default skipOpenApp to false", () => {
    // GIVEN
    const { useCase, signTransactionMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, TRANSACTION);

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      transaction: TRANSACTION,
      skipOpenApp: false,
    });
  });

  it("should apply the same default for an empty option object", () => {
    // GIVEN
    const { useCase, signTransactionMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, TRANSACTION, {});

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      transaction: TRANSACTION,
      skipOpenApp: false,
    });
  });

  it("should forward skipOpenApp", () => {
    // GIVEN
    const { useCase, signTransactionMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, TRANSACTION, { skipOpenApp: true });

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      transaction: TRANSACTION,
      skipOpenApp: true,
    });
  });
});
