import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { type ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

import { RegisterExternalAddressUseCase } from "./RegisterExternalAddressUseCase";

function makeUseCase() {
  const registerExternalAddress = vi.fn().mockReturnValue("DA_RETURN");
  const appBinder = { registerExternalAddress } as unknown as ContactsAppBinder;
  return {
    useCase: new RegisterExternalAddressUseCase(appBinder),
    registerExternalAddress,
  };
}

const VALID_INPUT: RegisterExternalAddressInput = {
  contactName: "Alice",
  scope: "Eth main",
  identifier: new Uint8Array(20).fill(0x11),
  blockchainFamily: "ethereum",
  chainId: 1n,
};

describe("RegisterExternalAddressUseCase", () => {
  it("validates input and delegates to the app binder", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    const result = useCase.execute(VALID_INPUT);

    expect(registerExternalAddress).toHaveBeenCalledWith(VALID_INPUT);
    expect(result).toBe("DA_RETURN");
  });

  it("accepts an existing contact group with correctly sized proofs", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    useCase.execute({
      ...VALID_INPUT,
      existingContactGroup: {
        groupHandle: new Uint8Array(64),
        hmacProof: new Uint8Array(32),
      },
    });

    expect(registerExternalAddress).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-printable contact name before dispatching", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    expect(() =>
      useCase.execute({ ...VALID_INPUT, contactName: "Amélie" }),
    ).toThrow(ContactsValidationError);
    expect(registerExternalAddress).not.toHaveBeenCalled();
  });

  it("rejects an Ethereum identifier of the wrong length", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    expect(() =>
      useCase.execute({ ...VALID_INPUT, identifier: new Uint8Array(19) }),
    ).toThrow(ContactsValidationError);
    expect(registerExternalAddress).not.toHaveBeenCalled();
  });

  it("rejects an unsupported blockchain family", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    expect(() =>
      useCase.execute({ ...VALID_INPUT, blockchainFamily: "dogecoin" }),
    ).toThrow(ContactsValidationError);
    expect(registerExternalAddress).not.toHaveBeenCalled();
  });

  it("requires chainId for the Ethereum family", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    expect(() =>
      useCase.execute({ ...VALID_INPUT, chainId: undefined }),
    ).toThrow(ContactsValidationError);
    expect(registerExternalAddress).not.toHaveBeenCalled();
  });

  it("rejects a wrong-sized existing group handle", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    expect(() =>
      useCase.execute({
        ...VALID_INPUT,
        existingContactGroup: {
          groupHandle: new Uint8Array(32),
          hmacProof: new Uint8Array(32),
        },
      }),
    ).toThrow(ContactsValidationError);
    expect(registerExternalAddress).not.toHaveBeenCalled();
  });
});
