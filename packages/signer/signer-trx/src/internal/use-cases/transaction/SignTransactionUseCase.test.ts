import { type TronAppBinder } from "@internal/app-binder/TronAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  const derivationPath = "44'/195'/0'/0/0";
  const transaction = Uint8Array.from([0x0a, 0x01, 0x00]);
  const returnedValue = { observable: "observable", cancel: () => {} };
  const signTransactionMock = vi.fn().mockReturnValue(returnedValue);
  const appBinderMock = {
    signTransaction: signTransactionMock,
  } as unknown as TronAppBinder;
  let useCase: SignTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SignTransactionUseCase(appBinderMock);
  });

  it("should forward the transaction and options to the app binder", () => {
    // WHEN
    const result = useCase.execute(derivationPath, transaction, {
      skipOpenApp: true,
    });

    // THEN
    expect(result).toEqual(returnedValue);
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath,
      transaction,
      skipOpenApp: true,
    });
  });

  it("should work without options", () => {
    // WHEN
    const result = useCase.execute(derivationPath, transaction);

    // THEN
    expect(result).toEqual(returnedValue);
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath,
      transaction,
      skipOpenApp: undefined,
    });
  });
});
