import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { SignDelegationAuthorizationUseCase } from "./SignDelegationAuthorizationUseCase";

describe("SignDelegationAuthorizationUseCase", () => {
  it("should call signPersonalMessage on appBinder with the correct arguments", () => {
    // Given
    const derivationPath = "44'/501'/0'/0'";
    const chainId = 2;
    const nonce = 42;
    const address = "address";
    const appBinder = {
      signDelegationAuthorization: vi.fn(),
    };
    const signMessageUseCase = new SignDelegationAuthorizationUseCase(
      appBinder as unknown as EthAppBinder,
    );

    // When
    signMessageUseCase.execute(derivationPath, nonce, address, chainId);

    // Then
    expect(appBinder.signDelegationAuthorization).toHaveBeenCalledWith({
      derivationPath,
      nonce,
      address,
      chainId,
    });
  });
});
