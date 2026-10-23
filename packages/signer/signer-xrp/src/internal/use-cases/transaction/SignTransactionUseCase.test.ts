import { from } from "rxjs";
import { vi } from "vitest";

import { Curve } from "@api/model/Curve";
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

  it("should default skipOpenApp to false and the curve to secp256k1", () => {
    // GIVEN
    const { useCase, signTransactionMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, TRANSACTION);

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      transaction: TRANSACTION,
      skipOpenApp: false,
      curve: Curve.Secp256k1,
    });
  });

  it("should apply the same defaults for an empty option object", () => {
    // GIVEN
    const { useCase, signTransactionMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, TRANSACTION, {});

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      transaction: TRANSACTION,
      skipOpenApp: false,
      curve: Curve.Secp256k1,
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
      curve: Curve.Secp256k1,
    });
  });

  it("should forward the curve", () => {
    // GIVEN
    const { useCase, signTransactionMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, TRANSACTION, { curve: Curve.Ed25519 });

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      transaction: TRANSACTION,
      skipOpenApp: false,
      curve: Curve.Ed25519,
    });
  });
});
