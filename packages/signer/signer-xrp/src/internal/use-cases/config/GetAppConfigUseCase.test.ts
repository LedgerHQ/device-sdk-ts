import {
  DeviceActionStatus,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
} from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type XrpAppBinder } from "@internal/app-binder/XrpAppBinder";

import { GetAppConfigUseCase } from "./GetAppConfigUseCase";

describe("GetAppConfigUseCase", () => {
  it("should return the result from appBinder.getAppConfig", () => {
    // ARRANGE
    const getAppConfigMock = vi.fn();
    const appBinderMock = {
      getAppConfig: getAppConfigMock,
    } as unknown as XrpAppBinder;
    const expectedResult: ExecuteDeviceActionReturnType<
      GetAppConfigDAOutput,
      GetAppConfigDAError,
      GetAppConfigDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: { version: "1.2.3" },
        },
      ]),
      cancel: vi.fn(),
    };
    getAppConfigMock.mockReturnValue(expectedResult);
    const useCase = new GetAppConfigUseCase(appBinderMock);

    // ACT
    const result = useCase.execute();

    // ASSERT
    expect(getAppConfigMock).toHaveBeenCalledWith({ skipOpenApp: false });
    expect(result).toEqual(expectedResult);
  });
});
