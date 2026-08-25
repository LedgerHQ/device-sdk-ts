import { type RenameContactInput } from "@api/model/RenameContact";
import { type ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";

import { RenameContactUseCase } from "./RenameContactUseCase";

function makeUseCase() {
  const renameContact = vi.fn().mockReturnValue("DA_RETURN");
  const appBinder = { renameContact } as unknown as ContactsAppBinder;
  return {
    useCase: new RenameContactUseCase(appBinder),
    renameContact,
  };
}

const VALID_INPUT: RenameContactInput = {
  previousContactName: "Alice",
  newContactName: "Bob",
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
};

describe("RenameContactUseCase", () => {
  it("delegates to the app binder", () => {
    const { useCase, renameContact } = makeUseCase();

    const result = useCase.execute(VALID_INPUT);

    expect(renameContact).toHaveBeenCalledWith(VALID_INPUT);
    expect(result).toBe("DA_RETURN");
  });

  it("does not validate — invalid input is forwarded, not thrown", () => {
    // Validation lives in the device action and surfaces as a typed DA error
    // state; the use case must never throw for bad input.
    const { useCase, renameContact } = makeUseCase();

    const invalidInput = { ...VALID_INPUT, newContactName: "" };
    expect(() => useCase.execute(invalidInput)).not.toThrow();
    expect(renameContact).toHaveBeenCalledWith(invalidInput);
  });
});
