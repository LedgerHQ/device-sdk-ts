import {
  DeviceActionStatus,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  it("should return the result from appBinder.signTransaction", () => {
    // ARRANGE
    const derivationPath = "44'/118'/0'/0/0";
    const hrp = "cosmos";
    const transaction = new Uint8Array([0x01, 0x02, 0x03]);
    const signTransactionMock = vi.fn();
    const appBinderMock = {
      signTransaction: signTransactionMock,
    } as unknown as CosmosAppBinder;
    const expectedResult: ExecuteDeviceActionReturnType<
      SignTransactionDAOutput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: new Uint8Array([0x01, 0x02]),
        },
      ]),
      cancel: vi.fn(),
    };
    signTransactionMock.mockReturnValue(expectedResult);
    const signTransactionUseCase = new SignTransactionUseCase(appBinderMock);

    // ACT
    const result = signTransactionUseCase.execute(
      derivationPath,
      hrp,
      transaction,
    );

    // ASSERT
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath,
      hrp,
      transaction,
      skipOpenApp: undefined,
    });
    expect(result).toEqual(expectedResult);
  });
});
