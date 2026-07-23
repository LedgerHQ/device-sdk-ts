import { vi } from "vitest";

import { type IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

import { GetAppConfigurationUseCase } from "./GetAppConfigurationUseCase";

describe("GetAppConfigurationUseCase", () => {
  it("should call appBinder.getVersion and return its result", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getVersionMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      getVersion: getVersionMock,
    } as unknown as IcpAppBinder;
    const useCase = new GetAppConfigurationUseCase(appBinderMock);

    // ACT
    const result = useCase.execute();

    // ASSERT
    expect(getVersionMock).toHaveBeenCalledWith({ skipOpenApp: false });
    expect(result).toBe(expectedResult);
  });
});
