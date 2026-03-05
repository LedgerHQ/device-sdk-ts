import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, it, vi } from "vitest";

import {
  type SignActionsDAError,
  type SignActionsDAInput,
  type SignActionsDAIntermediateValue,
  type SignActionsDAOutput,
  signActionsDAStateSteps,
} from "@api/app-binder/SignActionsDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import type { HyperliquidAction } from "@internal/app-binder/utils/actionTlvSerializer";

import { SignActionsDeviceAction } from "./SignActionsDeviceAction";

const exampleCertificate = new Uint8Array([0x01, 0x02, 0x03]);
const exampleMetadata = new Uint8Array([0x04, 0x05, 0x06]);

const exampleSignature = {
  r: "0xaa",
  s: "0xbb",
  v: 27,
};

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let setCertificateMock: ReturnType<typeof vi.fn>;
let sendMetadataMock: ReturnType<typeof vi.fn>;
let sendActionsMock: ReturnType<typeof vi.fn>;
let signActionsMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    setCertificate: setCertificateMock,
    sendMetadata: sendMetadataMock,
    sendActions: sendActionsMock,
    signActions: signActionsMock,
  };
}

describe("SignActionsDeviceAction (Hyperliquid)", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    setCertificateMock = vi.fn();
    sendMetadataMock = vi.fn();
    sendActionsMock = vi.fn();
    signActionsMock = vi.fn();
  });

  it.skip("happy path (skip open): SetCertificate -> SendMetadata -> SignActions (no actions)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Hyperliquid", version: "1.0.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      setCertificateMock.mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );
      sendMetadataMock.mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );
      signActionsMock.mockResolvedValue(
        CommandResultFactory({ data: exampleSignature }),
      );

      const input: SignActionsDAInput = {
        derivationPath: "44'/637'/0'/0'",
        certificate: exampleCertificate,
        signedMetadata: exampleMetadata,
        actions: [],
        skipOpenApp: true,
      };

      const action = new SignActionsDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signActionsDAStateSteps.SET_CERTIFICATE,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signActionsDAStateSteps.SEND_METADATA,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signActionsDAStateSteps.SIGN_ACTIONS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: [exampleSignature],
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        SignActionsDAOutput,
        SignActionsDAError,
        SignActionsDAIntermediateValue
      >[];

      testDeviceActionStates<
        SignActionsDAOutput,
        SignActionsDAInput,
        SignActionsDAError,
        SignActionsDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("happy path: SetCertificate -> SendMetadata -> SendAction -> SignActions", () =>
    new Promise<void>((resolve, reject) => {
      // GIVEN
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Hyperliquid", version: "1.0.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      setCertificateMock.mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );
      sendMetadataMock.mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );
      sendActionsMock.mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );
      const exampleSignature2 = [
        {
          r: "0xcc",
          s: "0xdd",
          v: 27,
        },
        {
          r: "0xcc",
          s: "0xdd",
          v: 27,
        },
      ];
      signActionsMock.mockResolvedValue(
        CommandResultFactory({ data: exampleSignature2 }),
      );

      const actions: HyperliquidAction[] = [
        {
          type: "order",
          orders: [
            {
              a: 0,
              b: true,
              p: "100",
              s: "100",
              t: {
                limit: {
                  tif: "Gtc",
                },
              },
              r: false,
            },
          ],
          grouping: "na",
          builder: {
            b: "0x1234567890123456789012345678901234567890",
            f: 0.01,
          },
          nonce: 1,
        },
        {
          type: "updateLeverage",
          asset: 0,
          isCross: false,
          leverage: 10,
          nonce: 2,
        },
      ];
      const input: SignActionsDAInput = {
        derivationPath: "44'/637'/0'/0'",
        certificate: exampleCertificate,
        signedMetadata: exampleMetadata,
        actions,
        skipOpenApp: true,
      };

      // WHEN
      const action = new SignActionsDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      // THEN
      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signActionsDAStateSteps.SET_CERTIFICATE,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signActionsDAStateSteps.SEND_METADATA,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signActionsDAStateSteps.SEND_ACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signActionsDAStateSteps.SIGN_ACTIONS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: exampleSignature2,
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        SignActionsDAOutput,
        SignActionsDAError,
        SignActionsDAIntermediateValue
      >[];

      testDeviceActionStates<
        SignActionsDAOutput,
        SignActionsDAInput,
        SignActionsDAError,
        SignActionsDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          expect(setCertificateMock).toHaveBeenCalledTimes(1);
          expect(setCertificateMock).toHaveBeenCalledWith({
            payload: exampleCertificate,
            keyUsageNumber: 0x11,
          });
          expect(sendMetadataMock).toHaveBeenCalledTimes(1);
          expect(sendMetadataMock).toHaveBeenCalledWith(exampleMetadata);
          expect(sendActionsMock).toHaveBeenCalledTimes(1);
          expect(sendActionsMock).toHaveBeenCalledWith(actions);
          expect(signActionsMock).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));

  it.skip("calls SetCertificate then SendMetadata then SignActions in order (no SendAction)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Hyperliquid", version: "1.0.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      const callOrder: string[] = [];
      setCertificateMock.mockImplementation(() => {
        callOrder.push("setCertificate");
        return Promise.resolve(CommandResultFactory({ data: undefined }));
      });
      sendMetadataMock.mockImplementation(() => {
        callOrder.push("sendMetadata");
        return Promise.resolve(CommandResultFactory({ data: undefined }));
      });
      signActionsMock.mockImplementation(() => {
        callOrder.push("signActions");
        return Promise.resolve(
          CommandResultFactory({ data: exampleSignature }),
        );
      });

      const input: SignActionsDAInput = {
        derivationPath: "44'/637'/0'/0'",
        certificate: exampleCertificate,
        signedMetadata: exampleMetadata,
        actions: [],
        skipOpenApp: true,
      };

      const action = new SignActionsDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signActionsDAStateSteps.SET_CERTIFICATE,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signActionsDAStateSteps.SEND_METADATA,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signActionsDAStateSteps.SIGN_ACTIONS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: [exampleSignature],
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        SignActionsDAOutput,
        SignActionsDAError,
        SignActionsDAIntermediateValue
      >[];

      testDeviceActionStates<
        SignActionsDAOutput,
        SignActionsDAInput,
        SignActionsDAError,
        SignActionsDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          expect(callOrder).toEqual([
            "setCertificate",
            "sendMetadata",
            "signActions",
          ]);
          resolve();
        },
        onError: reject,
      });
    }));
});
