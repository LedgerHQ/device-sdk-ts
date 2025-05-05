import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  it("should call getAddress on appBinder with the correct arguments", () => {
    // Given
    const derivationPath = "m/44'/60'/0'/0/0";
    const checkOnDevice = true;
    const returnChainCode = true;
    const options = {
      checkOnDevice,
      returnChainCode,
    };
    const getAddress = vi.fn();
    const appBinder = {
      getAddress,
    };
    const getAddressUseCase = new GetAddressUseCase(
      appBinder as unknown as EthAppBinder,
    );

    // When
    getAddressUseCase.execute(derivationPath, options);

    // Then
    expect(getAddress).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice,
      returnChainCode,
      skipOpenApp: false,
    });
  });
});
