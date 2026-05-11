import { ValidationError } from "@ledgerhq/device-management-kit";

import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { ProvideContactUseCase } from "./ProvideContactUseCase";

describe("ProvideContactUseCase", () => {
  const validArgs = {
    contactName: "Alice",
    scope: "Eth main",
    addressHex: "0x00000000000000000000000000000000deadbeef",
    groupHandleHex: "cc".repeat(64),
    hmacNameHex: "dd".repeat(32),
    hmacRestHex: "aa".repeat(32),
    derivationPath: "m/44'/60'/0'/0/0",
    chainId: 1,
  };

  function makeUseCase() {
    const provideContact = vi.fn().mockReturnValue("DA-return" as never);
    const binder = { provideContact } as unknown as EthAppBinder;
    return { useCase: new ProvideContactUseCase(binder), binder };
  }

  it("delegates to the binder after stripping the m-prefix from the path", () => {
    const { useCase, binder } = makeUseCase();

    const result = useCase.execute(validArgs);

    expect(binder.provideContact).toHaveBeenCalledWith({
      ...validArgs,
      derivationPath: "44'/60'/0'/0/0",
    });
    expect(result).toBe("DA-return");
  });

  it("refuses an invalid addressHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, addressHex: "0xnothex" }),
    ).toThrow(ValidationError);
    expect(binder.provideContact).not.toHaveBeenCalled();
  });

  it("refuses an over-length scope before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, scope: "x".repeat(33) }),
    ).toThrow(ValidationError);
    expect(binder.provideContact).not.toHaveBeenCalled();
  });

  it("refuses an invalid derivation path before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, derivationPath: "not-a-path" }),
    ).toThrow(ValidationError);
    expect(binder.provideContact).not.toHaveBeenCalled();
  });

  it("refuses a wrong-length groupHandleHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, groupHandleHex: "cc".repeat(32) }),
    ).toThrow(ValidationError);
    expect(binder.provideContact).not.toHaveBeenCalled();
  });

  it("refuses a wrong-length hmacNameHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, hmacNameHex: "dd".repeat(16) }),
    ).toThrow(ValidationError);
    expect(binder.provideContact).not.toHaveBeenCalled();
  });

  it("refuses a wrong-length hmacRestHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, hmacRestHex: "aa".repeat(16) }),
    ).toThrow(ValidationError);
    expect(binder.provideContact).not.toHaveBeenCalled();
  });
});
