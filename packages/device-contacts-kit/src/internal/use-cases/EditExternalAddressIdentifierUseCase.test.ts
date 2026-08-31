import { type EditExternalAddressIdentifierInput } from "@api/model/EditExternalAddressIdentifier";
import { type ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";

import { EditExternalAddressIdentifierUseCase } from "./EditExternalAddressIdentifierUseCase";

function makeUseCase() {
  const editExternalAddressIdentifier = vi.fn().mockReturnValue("DA_RETURN");
  const appBinder = {
    editExternalAddressIdentifier,
  } as unknown as ContactsAppBinder;
  return {
    useCase: new EditExternalAddressIdentifierUseCase(appBinder),
    editExternalAddressIdentifier,
  };
}

const VALID_INPUT: EditExternalAddressIdentifierInput = {
  contactName: "Alice",
  scope: "Eth main",
  previousIdentifier: new Uint8Array(20).fill(0x11),
  newIdentifier: new Uint8Array(20).fill(0x22),
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
  hmacRest: new Uint8Array(32).fill(0xaa),
};

describe("EditExternalAddressIdentifierUseCase", () => {
  it("delegates to the app binder", () => {
    const { useCase, editExternalAddressIdentifier } = makeUseCase();

    const result = useCase.execute(VALID_INPUT);

    expect(editExternalAddressIdentifier).toHaveBeenCalledWith(VALID_INPUT);
    expect(result).toBe("DA_RETURN");
  });

  it("does not validate — invalid input is forwarded, not thrown", () => {
    // Validation now lives in the device action and surfaces as a typed DA
    // error state; the use case must never throw for bad input.
    const { useCase, editExternalAddressIdentifier } = makeUseCase();

    const invalidInput = { ...VALID_INPUT, contactName: "" };
    expect(() => useCase.execute(invalidInput)).not.toThrow();
    expect(editExternalAddressIdentifier).toHaveBeenCalledWith(invalidInput);
  });
});
