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

  const setup = () => {
    const getAppConfigMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      getAppConfig: getAppConfigMock,
    } as unknown as XrpAppBinder;

    return {
      getAppConfigMock,
      useCase: new GetAppConfigUseCase(appBinderMock),
    };
  };

  it("should return the result from appBinder.getAppConfig", () => {
    // GIVEN
    const { getAppConfigMock, useCase } = setup();

    // WHEN
    const result = useCase.execute();

    // THEN
    expect(getAppConfigMock).toHaveBeenCalledWith({ skipOpenApp: false });
    expect(result).toEqual(expectedResult);
  });

  it("should default skipOpenApp to false when no option is given", () => {
    // GIVEN
    const { getAppConfigMock, useCase } = setup();

    // WHEN
    useCase.execute({});

    // THEN
    expect(getAppConfigMock).toHaveBeenCalledWith({ skipOpenApp: false });
  });

  it("should forward skipOpenApp", () => {
    // GIVEN
    const { getAppConfigMock, useCase } = setup();

    // WHEN
    useCase.execute({ skipOpenApp: true });

    // THEN
    expect(getAppConfigMock).toHaveBeenCalledWith({ skipOpenApp: true });
  });
});
