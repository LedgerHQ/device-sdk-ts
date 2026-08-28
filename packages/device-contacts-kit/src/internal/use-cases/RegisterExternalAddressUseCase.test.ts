import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { type ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";

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
  it("delegates to the app binder", () => {
    const { useCase, registerExternalAddress } = makeUseCase();

    const result = useCase.execute(VALID_INPUT);

    expect(registerExternalAddress).toHaveBeenCalledWith(VALID_INPUT);
    expect(result).toBe("DA_RETURN");
  });

  it("does not validate — invalid input is forwarded, not thrown", () => {
    // Validation now lives in the device action and surfaces as a typed DA
    // error state; the use case must never throw for bad input.
    const { useCase, registerExternalAddress } = makeUseCase();

    const invalidInput = { ...VALID_INPUT, contactName: "" };
    expect(() => useCase.execute(invalidInput)).not.toThrow();
    expect(registerExternalAddress).toHaveBeenCalledWith(invalidInput);
  });
});
