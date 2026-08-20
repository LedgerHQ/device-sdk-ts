import { ValidationError } from "@ledgerhq/device-management-kit";

import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { EditExternalAddressUseCase } from "./EditExternalAddressUseCase";

describe("EditExternalAddressUseCase", () => {
  const validArgs = {
    contactName: "Alice",
    oldAddressHex: "0x00000000000000000000000000000000deadbeef",
    newAddressHex: "0x5555555555555555555555555555555555555555",
    scope: "Eth main",
    groupHandleHex: "cc".repeat(64),
    hmacProofHex: "dd".repeat(32),
    hmacRestHex: "aa".repeat(32),
    derivationPath: "m/44'/60'/0'/0/0",
    chainId: 1,
  };

  function makeUseCase() {
    const editExternalAddress = vi.fn().mockReturnValue("DA-return" as never);
    const binder = { editExternalAddress } as unknown as EthAppBinder;
    return { useCase: new EditExternalAddressUseCase(binder), binder };
  }

  it("delegates to the binder after stripping the m-prefix from the path", () => {
    const { useCase, binder } = makeUseCase();

    const result = useCase.execute(validArgs);

    expect(binder.editExternalAddress).toHaveBeenCalledWith({
      ...validArgs,
      derivationPath: "44'/60'/0'/0/0",
    });
    expect(result).toBe("DA-return");
  });

  it("refuses an invalid newAddressHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, newAddressHex: "0xnothex" }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddress).not.toHaveBeenCalled();
  });

  it("refuses an invalid oldAddressHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, oldAddressHex: "0x1234" }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddress).not.toHaveBeenCalled();
  });

  it("refuses an over-length scope before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, scope: "x".repeat(33) }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddress).not.toHaveBeenCalled();
  });

  it("refuses an invalid derivation path before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, derivationPath: "not-a-path" }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddress).not.toHaveBeenCalled();
  });

  it("refuses a wrong-length hmacRestHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, hmacRestHex: "aa".repeat(16) }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddress).not.toHaveBeenCalled();
  });
});
