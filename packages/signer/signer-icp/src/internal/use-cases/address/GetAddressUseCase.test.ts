import { vi } from "vitest";

import { type IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  it("should forward the path and default options to appBinder.getAddress", () => {
    // ARRANGE
    const derivationPath = "44'/223'/0'/0/0";
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getAddressMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      getAddress: getAddressMock,
    } as unknown as IcpAppBinder;
    const useCase = new GetAddressUseCase(appBinderMock);

    // ACT
    const result = useCase.execute(derivationPath);

    // ASSERT
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: false,
      skipOpenApp: false,
    });
    expect(result).toBe(expectedResult);
  });

  it("should forward provided options", () => {
    // ARRANGE
    const derivationPath = "44'/223'/0'/0/0";
    const getAddressMock = vi.fn().mockReturnValue({});
    const appBinderMock = {
      getAddress: getAddressMock,
    } as unknown as IcpAppBinder;
    const useCase = new GetAddressUseCase(appBinderMock);

    // ACT
    useCase.execute(derivationPath, { checkOnDevice: true, skipOpenApp: true });

    // ASSERT
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: true,
      skipOpenApp: true,
    });
  });
});
