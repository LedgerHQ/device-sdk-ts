import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type GenerateTransactionDAError,
  type GenerateTransactionDAInput,
  type GenerateTransactionDAIntermediateValue,
} from "@api/app-binder/GenerateTransactionDeviceActionTypes";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "./__test-utils__/testDeviceActionStates";
import {
  GenerateTransactionDeviceAction,
  type MachineDependencies,
} from "./GenerateTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const testPublicKey = "2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB";
const testTransaction = "base64-serialised-transaction";

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getPublicKeyMock: ReturnType<typeof vi.fn>;
let generateTransactionMock: ReturnType<typeof vi.fn>;

function extractDeps(): MachineDependencies {
  return {
    getPublicKey: getPublicKeyMock,
    generateTransaction: generateTransactionMock,
  };
}

describe("GenerateTransactionDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    getPublicKeyMock = vi.fn();
    generateTransactionMock = vi.fn();
  });

  it("happy path (skipOpenApp): getPublicKey -> generateTransaction -> success", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      generateTransactionMock.mockResolvedValue(testTransaction);

      const input: GenerateTransactionDAInput = {
        derivationPath: defaultDerivation,
        skipOpenApp: true,
      };

      const action = new GenerateTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: testTransaction,
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        string,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        GenerateTransactionDAInput,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(generateTransactionMock).toHaveBeenCalledOnce();
          resolve();
        },
        onError: reject,
      });
    }));

  it("getPublicKey rejects -> error", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockRejectedValue(new Error("device disconnected"));
      generateTransactionMock.mockResolvedValue(testTransaction);

      const input: GenerateTransactionDAInput = {
        derivationPath: defaultDerivation,
        skipOpenApp: true,
      };

      const action = new GenerateTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new UnknownDAError("device disconnected"),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        string,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        GenerateTransactionDAInput,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(generateTransactionMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("generateTransaction rejects -> error", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      generateTransactionMock.mockRejectedValue(
        new Error("transaction generation failed"),
      );

      const input: GenerateTransactionDAInput = {
        derivationPath: defaultDerivation,
        skipOpenApp: true,
      };

      const action = new GenerateTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new UnknownDAError("transaction generation failed"),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        string,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        GenerateTransactionDAInput,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(generateTransactionMock).toHaveBeenCalledOnce();
          resolve();
        },
        onError: reject,
      });
    }));

  it("passes derivationPath to getPublicKey", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      generateTransactionMock.mockResolvedValue(testTransaction);

      const input: GenerateTransactionDAInput = {
        derivationPath: defaultDerivation,
        skipOpenApp: true,
      };

      const action = new GenerateTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: testTransaction,
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        string,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        GenerateTransactionDAInput,
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                derivationPath: defaultDerivation,
                checkOnDevice: false,
              },
            }),
          );
          expect(generateTransactionMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: { publicKey: testPublicKey },
            }),
          );
          resolve();
        },
        onError: reject,
      });
    }));
});
