import { type RegisterLedgerAccountInput } from "@api/model/RegisterLedgerAccount";
import { type ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";

import { RegisterLedgerAccountUseCase } from "./RegisterLedgerAccountUseCase";

function makeUseCase() {
  const registerLedgerAccount = vi.fn().mockReturnValue("DA_RETURN");
  const appBinder = { registerLedgerAccount } as unknown as ContactsAppBinder;
  return {
    useCase: new RegisterLedgerAccountUseCase(appBinder),
    registerLedgerAccount,
  };
}

const VALID_INPUT: RegisterLedgerAccountInput = {
  accountName: "Alice",
  derivationPath: "m/44'/60'/0'/0/0",
  blockchainFamily: "ethereum",
  chainId: 1n,
};

describe("RegisterLedgerAccountUseCase", () => {
  it("delegates to the app binder", () => {
    const { useCase, registerLedgerAccount } = makeUseCase();

    const result = useCase.execute(VALID_INPUT);

    expect(registerLedgerAccount).toHaveBeenCalledWith(VALID_INPUT);
    expect(result).toBe("DA_RETURN");
  });

  it("does not validate — invalid input is forwarded, not thrown", () => {
    // Validation now lives in the device action and surfaces as a typed DA
    // error state; the use case must never throw for bad input.
    const { useCase, registerLedgerAccount } = makeUseCase();

    const invalidInput = { ...VALID_INPUT, accountName: "" };
    expect(() => useCase.execute(invalidInput)).not.toThrow();
    expect(registerLedgerAccount).toHaveBeenCalledWith(invalidInput);
  });
});
