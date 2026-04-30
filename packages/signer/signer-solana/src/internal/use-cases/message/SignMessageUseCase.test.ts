import { SignMessageVersion } from "@api/model/MessageOptions";
import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { SignMessageUseCase } from "./SignMessageUseCase";

describe("SignMessageUseCase", () => {
  it("should call signMessage on appBinder with a string message", () => {
    // Given
    const derivationPath = "44'/501'/0'/0'";
    const message = "Hello world";
    const appBinder = {
      signMessage: vi.fn(),
    };
    const signMessageUseCase = new SignMessageUseCase(
      appBinder as unknown as SolanaAppBinder,
    );

    // When
    signMessageUseCase.execute(derivationPath, message);

    // Then
    expect(appBinder.signMessage).toHaveBeenCalledWith({
      derivationPath,
      message,
      skipOpenApp: false,
    });
  });

  it("passes signers and version from options to appBinder.signMessage", () => {
    // Given
    const derivationPath = "44'/501'/0'/0'";
    const message = "Hello world";
    const signers = [new Uint8Array(32).fill(0x22)];
    const appBinder = {
      signMessage: vi.fn(),
    };
    const signMessageUseCase = new SignMessageUseCase(
      appBinder as unknown as SolanaAppBinder,
    );

    // When
    signMessageUseCase.execute(derivationPath, message, {
      version: SignMessageVersion.V1,
      signers,
    });

    // Then
    expect(appBinder.signMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        derivationPath,
        message,
        version: SignMessageVersion.V1,
        signers,
      }),
    );
  });

  it("should call signMessage on appBinder with a Uint8Array message", () => {
    // Given
    const derivationPath = "44'/501'/0'/0'";
    const message = new Uint8Array([0xff, 0x01, 0x02]);
    const appBinder = {
      signMessage: vi.fn(),
    };
    const signMessageUseCase = new SignMessageUseCase(
      appBinder as unknown as SolanaAppBinder,
    );

    // When
    signMessageUseCase.execute(derivationPath, message);

    // Then
    expect(appBinder.signMessage).toHaveBeenCalledWith({
      derivationPath,
      message,
      skipOpenApp: false,
    });
  });
});
