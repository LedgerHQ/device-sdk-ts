import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  const signTransaction = vi.fn();
  const appBinder = {
    signTransaction,
  } as unknown as BtcLegacyAppBinder<string>;
  const transaction: LegacyCreateTransactionArg = {
    inputs: [],
    associatedKeysets: [],
    outputScriptHex: "00",
  };

  beforeEach(() => {
    signTransaction.mockReset();
  });

  it("should call the app binder with the default options", () => {
    const expected = Symbol("result");
    signTransaction.mockReturnValue(expected);

    const result = new SignTransactionUseCase(appBinder).execute(transaction);

    expect(signTransaction).toHaveBeenCalledWith({
      transaction,
      skipOpenApp: false,
    });
    expect(result).toBe(expected);
  });

  it("should forward skipOpenApp", () => {
    new SignTransactionUseCase(appBinder).execute(transaction, {
      skipOpenApp: true,
    });

    expect(signTransaction).toHaveBeenCalledWith({
      transaction,
      skipOpenApp: true,
    });
  });
});
