import { ValidationError } from "@api/contacts/validation";
import { type ContactsAppBinder } from "@internal/contacts/app-binder/ContactsAppBinder";

import { EditExternalAddressLabelUseCase } from "./EditExternalAddressLabelUseCase";

describe("EditExternalAddressLabelUseCase", () => {
  const validArgs = {
    contactName: "Alice",
    oldLabel: "Eth main",
    newLabel: "Eth cold",
    addressHex: "0x00000000000000000000000000000000deadbeef",
    groupHandleHex: "cc".repeat(64),
    hmacProofHex: "dd".repeat(32),
    hmacRestHex: "aa".repeat(32),
    derivationPath: "m/44'/60'/0'/0/0",
    chainId: 1,
  };

  function makeUseCase() {
    const editExternalAddressLabel = vi
      .fn()
      .mockReturnValue("DA-return" as never);
    const binder = { editExternalAddressLabel } as unknown as ContactsAppBinder;
    return { useCase: new EditExternalAddressLabelUseCase(binder), binder };
  }

  it("delegates to the binder after stripping the m-prefix from the path", () => {
    const { useCase, binder } = makeUseCase();

    const result = useCase.execute(validArgs);

    expect(binder.editExternalAddressLabel).toHaveBeenCalledWith({
      ...validArgs,
      derivationPath: "44'/60'/0'/0/0",
    });
    expect(result).toBe("DA-return");
  });

  it("refuses an over-length newLabel before touching the binder", () => {
    const { useCase, binder } = makeUseCase();
    const oversized = "x".repeat(33); // SCOPE_BUFFER_LENGTH=33 → max usable is 32

    expect(() =>
      useCase.execute({ ...validArgs, newLabel: oversized }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddressLabel).not.toHaveBeenCalled();
  });

  it("refuses an over-length oldLabel before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, oldLabel: "y".repeat(33) }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddressLabel).not.toHaveBeenCalled();
  });

  it("refuses an invalid derivation path before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, derivationPath: "not-a-path" }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddressLabel).not.toHaveBeenCalled();
  });

  it("refuses an invalid addressHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, addressHex: "0xnothex" }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddressLabel).not.toHaveBeenCalled();
  });

  it("refuses a wrong-length groupHandleHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, groupHandleHex: "cc".repeat(32) }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddressLabel).not.toHaveBeenCalled();
  });

  it("refuses a wrong-length hmacRestHex before touching the binder", () => {
    const { useCase, binder } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, hmacRestHex: "aa".repeat(16) }),
    ).toThrow(ValidationError);
    expect(binder.editExternalAddressLabel).not.toHaveBeenCalled();
  });
});
