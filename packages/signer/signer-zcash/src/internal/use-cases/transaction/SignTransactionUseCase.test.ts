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
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  it("should return the result from appBinder.signTransaction", () => {
    const transactionArg = {
      inputs: [
        [
          {
            version: new Uint8Array([0x05, 0x00, 0x00, 0x80]),
            inputs: [],
            outputs: [],
            locktime: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
          },
          0,
          undefined,
          undefined,
        ],
      ],
      associatedKeysets: ["44'/133'/0'/0/0"],
      outputScriptHex: "01",
      additionals: ["zcash"],
    } satisfies LegacyCreateTransactionArg;
    const signTransactionMock = vi.fn();
    const appBinderMock = {
      signTransaction: signTransactionMock,
    } as unknown as ZcashAppBinder;
    const expectedResult: ExecuteDeviceActionReturnType<
      SignTransactionDAOutput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: "0xabcdef" as SignTransactionDAOutput,
        },
      ]),
      cancel: vi.fn(),
    };
    signTransactionMock.mockReturnValue(expectedResult);
    const signTransactionUseCase = new SignTransactionUseCase(appBinderMock);

    const result = signTransactionUseCase.execute(transactionArg, {
      skipOpenApp: true,
    });

    expect(signTransactionMock).toHaveBeenCalledWith({
      transactionArg,
      skipOpenApp: true,
    });
    expect(result).toEqual(expectedResult);
  });
});
