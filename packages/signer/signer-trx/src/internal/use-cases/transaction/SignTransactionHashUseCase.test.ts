import { type TronAppBinder } from "@internal/app-binder/TronAppBinder";

import { SignTransactionHashUseCase } from "./SignTransactionHashUseCase";

describe("SignTransactionHashUseCase", () => {
  const derivationPath = "44'/195'/0'/0/0";
  const transactionHash = new Uint8Array(32).fill(0x25);
  const returnedValue = { observable: "observable", cancel: () => {} };
  const signTransactionHashMock = vi.fn().mockReturnValue(returnedValue);
  const appBinderMock = {
    signTransactionHash: signTransactionHashMock,
  } as unknown as TronAppBinder;
  let useCase: SignTransactionHashUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SignTransactionHashUseCase(appBinderMock);
  });

  it("should forward the transaction hash and options to the app binder", () => {
    // WHEN
    const result = useCase.execute(derivationPath, transactionHash, {
      skipOpenApp: true,
    });

    // THEN
    expect(result).toEqual(returnedValue);
    expect(signTransactionHashMock).toHaveBeenCalledWith({
      derivationPath,
      transactionHash,
      skipOpenApp: true,
    });
  });

  it("should work without options", () => {
    // WHEN
    const result = useCase.execute(derivationPath, transactionHash);

    // THEN
    expect(result).toEqual(returnedValue);
    expect(signTransactionHashMock).toHaveBeenCalledWith({
      derivationPath,
      transactionHash,
      skipOpenApp: undefined,
    });
  });
});
