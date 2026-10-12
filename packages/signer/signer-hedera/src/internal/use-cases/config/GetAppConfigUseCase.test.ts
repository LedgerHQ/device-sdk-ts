import { vi } from "vitest";

import { type HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

import { GetAppConfigUseCase } from "./GetAppConfigUseCase";

describe("GetAppConfigUseCase", () => {
  it("should call appBinder.getAppConfig and open the app", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getAppConfigMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      getAppConfig: getAppConfigMock,
    } as unknown as HederaAppBinder;
    const useCase = new GetAppConfigUseCase(appBinderMock);

    // ACT
    const result = useCase.execute();

    // ASSERT
    expect(getAppConfigMock).toHaveBeenCalledWith({ skipOpenApp: false });
    expect(result).toBe(expectedResult);
  });

  it("should forward provided options", () => {
    // ARRANGE
    const getAppConfigMock = vi.fn().mockReturnValue({});
    const appBinderMock = {
      getAppConfig: getAppConfigMock,
    } as unknown as HederaAppBinder;
    const useCase = new GetAppConfigUseCase(appBinderMock);

    // ACT
    useCase.execute({ skipOpenApp: true });

    // ASSERT
    expect(getAppConfigMock).toHaveBeenCalledWith({ skipOpenApp: true });
  });
});
