import { ValidationError } from "@ledgerhq/device-management-kit";

import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { ProvideLedgerAccountUseCase } from "./ProvideLedgerAccountUseCase";

describe("ProvideLedgerAccountUseCase", () => {
  const validArgs = {
    accountName: "Vault",
    hmacProofHex: "ee".repeat(32),
    derivationPath: "m/44'/60'/0'/0/0",
    chainId: 1,
  };

  function makeUseCase() {
    const provideLedgerAccount = vi.fn().mockReturnValue("DA-return" as never);
    const binder = { provideLedgerAccount } as unknown as EthAppBinder;
    return { useCase: new ProvideLedgerAccountUseCase(binder), binder };
  }

  it("delegates to the binder after stripping the m-prefix from the path", () => {
    const { useCase, binder } = makeUseCase();

    const result = useCase.execute(validArgs);

    expect(binder.provideLedgerAccount).toHaveBeenCalledWith({
      ...validArgs,
      derivationPath: "44'/60'/0'/0/0",
    });
    expect(result).toBe("DA-return");
  });

  it("refuses an over-length accountName before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, accountName: "x".repeat(33) }),
    ).toThrow(ValidationError);
    expect(binder.provideLedgerAccount).not.toHaveBeenCalled();
  });

  it("refuses an invalid derivation path before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, derivationPath: "not-a-path" }),
    ).toThrow(ValidationError);
    expect(binder.provideLedgerAccount).not.toHaveBeenCalled();
  });

  it("refuses an invalid chainId before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() => useCase.execute({ ...validArgs, chainId: 0 })).toThrow(
      ValidationError,
    );
    expect(binder.provideLedgerAccount).not.toHaveBeenCalled();
  });

  it("refuses a wrong-length hmacProofHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, hmacProofHex: "ee".repeat(16) }),
    ).toThrow(ValidationError);
    expect(binder.provideLedgerAccount).not.toHaveBeenCalled();
  });
});
