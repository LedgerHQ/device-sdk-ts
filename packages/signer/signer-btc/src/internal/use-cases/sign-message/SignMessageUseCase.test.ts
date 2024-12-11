import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";

import { SignMessageUseCase } from "./SignMessageUseCase";

describe("SignMessageUseCase", () => {
  it("should call signPersonalMessage on appBinder with the correct arguments", () => {
    // Given
    const derivationPath = "44'/501'/0'/0'";
    const message = "Hello world";
    const appBinder = {
      signMessage: jest.fn(),
    };
    const signMessageUseCase = new SignMessageUseCase(
      appBinder as unknown as BtcAppBinder,
    );

    // When
    signMessageUseCase.execute(derivationPath, message);

    // Then
    expect(appBinder.signMessage).toHaveBeenCalledWith({
      derivationPath,
      message,
    });
  });
});
