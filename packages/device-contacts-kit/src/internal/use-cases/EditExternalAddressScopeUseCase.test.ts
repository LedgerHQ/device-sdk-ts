import { type EditExternalAddressScopeInput } from "@api/model/EditExternalAddressScope";
import { type ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";

import { EditExternalAddressScopeUseCase } from "./EditExternalAddressScopeUseCase";

function makeUseCase() {
  const editExternalAddressScope = vi.fn().mockReturnValue("DA_RETURN");
  const appBinder = {
    editExternalAddressScope,
  } as unknown as ContactsAppBinder;
  return {
    useCase: new EditExternalAddressScopeUseCase(appBinder),
    editExternalAddressScope,
  };
}

const VALID_INPUT: EditExternalAddressScopeInput = {
  contactName: "Alice",
  previousScope: "Eth main",
  newScope: "Eth cold",
  identifier: new Uint8Array(20).fill(0x11),
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
  hmacRest: new Uint8Array(32).fill(0xaa),
};

describe("EditExternalAddressScopeUseCase", () => {
  it("delegates to the app binder", () => {
    const { useCase, editExternalAddressScope } = makeUseCase();

    const result = useCase.execute(VALID_INPUT);

    expect(editExternalAddressScope).toHaveBeenCalledWith(VALID_INPUT);
    expect(result).toBe("DA_RETURN");
  });

  it("does not validate — invalid input is forwarded, not thrown", () => {
    // Validation now lives in the device action and surfaces as a typed DA
    // error state; the use case must never throw for bad input.
    const { useCase, editExternalAddressScope } = makeUseCase();

    const invalidInput = { ...VALID_INPUT, contactName: "" };
    expect(() => useCase.execute(invalidInput)).not.toThrow();
    expect(editExternalAddressScope).toHaveBeenCalledWith(invalidInput);
  });
});
