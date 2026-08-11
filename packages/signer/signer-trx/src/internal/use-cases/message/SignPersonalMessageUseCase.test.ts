import { type TronAppBinder } from "@internal/app-binder/TronAppBinder";

import { SignPersonalMessageUseCase } from "./SignPersonalMessageUseCase";

describe("SignPersonalMessageUseCase", () => {
  const derivationPath = "44'/195'/0'/0/0";
  const returnedValue = { observable: "observable", cancel: () => {} };
  const signPersonalMessageMock = vi.fn().mockReturnValue(returnedValue);
  const appBinderMock = {
    signPersonalMessage: signPersonalMessageMock,
  } as unknown as TronAppBinder;
  let useCase: SignPersonalMessageUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SignPersonalMessageUseCase(appBinderMock);
  });

  it("should UTF-8 encode a string message and forward options to the app binder", () => {
    // WHEN
    const result = useCase.execute(derivationPath, "hello", {
      skipOpenApp: true,
    });

    // THEN
    expect(result).toEqual(returnedValue);
    expect(signPersonalMessageMock).toHaveBeenCalledWith({
      derivationPath,
      message: Uint8Array.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]),
      skipOpenApp: true,
    });
  });

  it("should pass a Uint8Array message through unchanged", () => {
    // GIVEN bytes that are not valid UTF-8 text
    const message = Uint8Array.from([0x00, 0xff, 0x80, 0x01]);

    // WHEN
    const result = useCase.execute(derivationPath, message);

    // THEN
    expect(result).toEqual(returnedValue);
    expect(signPersonalMessageMock).toHaveBeenCalledWith({
      derivationPath,
      message,
      skipOpenApp: undefined,
    });
  });
});
