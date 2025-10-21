import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { VerifySafeAddressUseCase } from "./VerifySafeAddressUseCase";

describe("VerifySafeAddressUseCase", () => {
  it("should call verifySafeAddress on appBinder with the correct arguments", () => {
    // Given
    const safeContractAddress = "0x1234567890123456789012345678901234567890";
    const options = {
      chainId: 1,
    };
    const appBinder: EthAppBinder = {
      verifySafeAddress: vi.fn(),
    } as unknown as EthAppBinder;
    const useCase = new VerifySafeAddressUseCase(appBinder);

    // When
    useCase.execute(safeContractAddress, options);

    // Then
    expect(appBinder.verifySafeAddress).toHaveBeenCalledWith({
      safeContractAddress,
      options,
    });
  });

  it("should call verifySafeAddress on appBinder without options when not provided", () => {
    // Given
    const safeContractAddress = "0x1234567890123456789012345678901234567890";
    const appBinder: EthAppBinder = {
      verifySafeAddress: vi.fn(),
    } as unknown as EthAppBinder;
    const useCase = new VerifySafeAddressUseCase(appBinder);

    // When
    useCase.execute(safeContractAddress);

    // Then
    expect(appBinder.verifySafeAddress).toHaveBeenCalledWith({
      safeContractAddress,
      options: undefined,
    });
  });
});
