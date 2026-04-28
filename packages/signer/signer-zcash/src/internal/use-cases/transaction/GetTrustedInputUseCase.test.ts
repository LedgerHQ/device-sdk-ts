import {
  DeviceActionStatus,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetTrustedInputDAError,
  type GetTrustedInputDAIntermediateValue,
  type GetTrustedInputDAOutput,
} from "@api/app-binder/GetTrustedInputActionTypes";
import { type ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

import { GetTrustedInputUseCase } from "./GetTrustedInputUseCase";

describe("GetTrustedInputUseCase", () => {
  it("should call getTrustedInput on appBinder with default options", () => {
    const transaction = new Uint8Array([0x01, 0x02, 0x03]);
    const getTrustedInputMock = vi.fn();
    const appBinder = {
      getTrustedInput: getTrustedInputMock,
    } as unknown as ZcashAppBinder;

    const expectedResult: ExecuteDeviceActionReturnType<
      GetTrustedInputDAOutput,
      GetTrustedInputDAError,
      GetTrustedInputDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: {
            statusCode: new Uint8Array([0x90, 0x00]),
            data: new Uint8Array([0xaa]),
          },
        },
      ]),
      cancel: vi.fn(),
    };
    getTrustedInputMock.mockReturnValue(expectedResult);

    const useCase = new GetTrustedInputUseCase(appBinder);
    const result = useCase.execute(transaction);

    expect(getTrustedInputMock).toHaveBeenCalledWith({
      transaction,
      indexLookup: undefined,
      skipOpenApp: false,
    });
    expect(result).toBe(expectedResult);
  });

  it("should forward indexLookup and skipOpenApp from options", () => {
    const transaction = new Uint8Array([0x0a, 0x0b, 0x0c]);
    const getTrustedInputMock = vi.fn().mockReturnValue({
      observable: from([]),
      cancel: vi.fn(),
    });
    const appBinder = {
      getTrustedInput: getTrustedInputMock,
    } as unknown as ZcashAppBinder;

    const useCase = new GetTrustedInputUseCase(appBinder);
    useCase.execute(transaction, {
      indexLookup: 42,
      skipOpenApp: true,
    });

    expect(getTrustedInputMock).toHaveBeenCalledWith({
      transaction,
      indexLookup: 42,
      skipOpenApp: true,
    });
  });
});
