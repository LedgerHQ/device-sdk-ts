import { ValidationError } from "@api/contacts/validation";
import { ContactsAppBinder } from "@internal/contacts/app-binder/ContactsAppBinder";

import { RenameContactUseCase } from "./RenameContactUseCase";

describe("RenameContactUseCase", () => {
  const validArgs = {
    oldName: "Alice",
    newName: "Alicia",
    groupHandleHex: "cc".repeat(64),
    hmacProofHex: "dd".repeat(32),
    derivationPath: "m/44'/60'/0'/0/0",
  };

  function makeUseCase() {
    const renameContact = vi.fn().mockReturnValue("DA-return" as never);
    const binder = { renameContact } as unknown as ContactsAppBinder;
    const useCase = new RenameContactUseCase(binder);
    return { useCase, renameContact };
  }

  it("delegates to the binder after stripping the m-prefix from the path", () => {
    const { useCase, renameContact } = makeUseCase();

    const result = useCase.execute(validArgs);

    expect(renameContact).toHaveBeenCalledWith({
      ...validArgs,
      derivationPath: "44'/60'/0'/0/0",
    });
    expect(result).toBe("DA-return");
  });

  it("accepts paths without the m-prefix unchanged", () => {
    const { useCase, renameContact } = makeUseCase();

    useCase.execute({ ...validArgs, derivationPath: "44'/60'/0'/0/0" });

    expect(renameContact).toHaveBeenCalledWith(
      expect.objectContaining({ derivationPath: "44'/60'/0'/0/0" }),
    );
  });

  it("refuses an over-length newName before touching the binder", () => {
    const { useCase, renameContact } = makeUseCase();
    const oversized = "x".repeat(33); // CONTACT_NAME_BUFFER_LENGTH=33 → max usable is 32

    expect(() => useCase.execute({ ...validArgs, newName: oversized })).toThrow(
      ValidationError,
    );
    expect(renameContact).not.toHaveBeenCalled();
  });

  it("refuses an over-length oldName before touching the binder", () => {
    const { useCase, renameContact } = makeUseCase();
    const oversized = "y".repeat(33);

    expect(() => useCase.execute({ ...validArgs, oldName: oversized })).toThrow(
      ValidationError,
    );
    expect(renameContact).not.toHaveBeenCalled();
  });

  it("refuses an invalid derivation path before touching the binder", () => {
    const { useCase, renameContact } = makeUseCase();

    expect(() =>
      useCase.execute({ ...validArgs, derivationPath: "not-a-path" }),
    ).toThrow(ValidationError);
    expect(renameContact).not.toHaveBeenCalled();
  });
});
