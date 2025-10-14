import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { DisplaySafeAccountUseCase } from "./DisplaySafeAccountUseCase";

describe("DisplaySafeAccountUseCase", () => {
  it("should call displaySafeAccount on appBinder with the correct arguments", () => {
    // Given
    const safeContractAddress = "0x1234567890123456789012345678901234567890";
    const options = {
      chainId: 1,
    };
    const appBinder: EthAppBinder = {
      displaySafeAccount: vi.fn(),
    } as unknown as EthAppBinder;
    const useCase = new DisplaySafeAccountUseCase(appBinder);

    // When
    useCase.execute(safeContractAddress, options);

    // Then
    expect(appBinder.displaySafeAccount).toHaveBeenCalledWith({
      safeContractAddress,
      options,
    });
  });

  it("should call displaySafeAccount on appBinder without options when not provided", () => {
    // Given
    const safeContractAddress = "0x1234567890123456789012345678901234567890";
    const appBinder: EthAppBinder = {
      displaySafeAccount: vi.fn(),
    } as unknown as EthAppBinder;
    const useCase = new DisplaySafeAccountUseCase(appBinder);

    // When
    useCase.execute(safeContractAddress);

    // Then
    expect(appBinder.displaySafeAccount).toHaveBeenCalledWith({
      safeContractAddress,
      options: undefined,
    });
  });
});
