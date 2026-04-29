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
import { type CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";

import { GetAppConfigUseCase } from "./GetAppConfigUseCase";

describe("GetAppConfigUseCase", () => {
  it("should return the result from appBinder.getAppConfig", () => {
    // ARRANGE
    const getAppConfigMock = vi.fn();
    const appBinderMock = {
      getAppConfig: getAppConfigMock,
    } as unknown as CosmosAppBinder;
    const expectedResult: ExecuteDeviceActionReturnType<
      GetAppConfigDAOutput,
      GetAppConfigDAError,
      GetAppConfigDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: {
            major: 1,
            minor: 2,
            patch: 3,
          },
        },
      ]),
      cancel: vi.fn(),
    };
    getAppConfigMock.mockReturnValue(expectedResult);
    const getAppConfigUseCase = new GetAppConfigUseCase(appBinderMock);

    // ACT
    const result = getAppConfigUseCase.execute();

    // ASSERT
    expect(getAppConfigMock).toHaveBeenCalledWith({
      skipOpenApp: false,
    });
    expect(result).toEqual(expectedResult);
  });
});
