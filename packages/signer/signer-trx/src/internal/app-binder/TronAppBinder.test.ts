import {
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";

import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
} from "@api/app-binder/GetAddressDeviceActionTypes";
import {
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
} from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { APP_NAME } from "@internal/app-binder/constants";

import { TronAppBinder } from "./TronAppBinder";

describe("TronAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    sendCommand: vi.fn(),
    executeDeviceAction: vi.fn(),
  } as unknown as DeviceManagementKit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new TronAppBinder(
      {} as DeviceManagementKit,
      {} as DeviceSessionId,
    );
    expect(binder).toBeDefined();
  });

  describe("getAddress", () => {
    it("should return the address", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const output: GetAddressDAOutput = {
          publicKey: "0401020304",
          address: "TWdnWBzFdBP1b8sqZ5RcFDbkV3sBmnxsYu",
        };

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output,
            } as DeviceActionState<
              GetAddressDAOutput,
              GetAddressDAError,
              GetAddressDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        const { observable } = binder.getAddress({
          derivationPath: "44'/195'/0'/0/0",
          checkOnDevice: false,
          skipOpenApp: false,
        });

        // THEN
        const states: DeviceActionState<
          GetAddressDAOutput,
          GetAddressDAError,
          GetAddressDAIntermediateValue
        >[] = [];
        observable.subscribe({
          next: (state) => states.push(state),
          error: reject,
          complete: () => {
            try {
              expect(states).toEqual([
                { status: DeviceActionStatus.Completed, output },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    describe("calls executeDeviceAction with the correct params", () => {
      const derivationPath = "44'/195'/0'/0/0";

      it("requires no user interaction when checkOnDevice is false", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.getAddress({
          derivationPath,
          checkOnDevice: false,
          skipOpenApp: false,
        });

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "sessionId",
            deviceAction: new SendCommandInAppDeviceAction({
              input: {
                command: new GetAddressCommand({
                  derivationPath,
                  checkOnDevice: false,
                }),
                appName: APP_NAME,
                requiredUserInteraction: UserInteractionRequired.None,
                skipOpenApp: false,
              },
            }),
          }),
        );
      });

      it("requires VerifyAddress interaction when checkOnDevice is true", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.getAddress({
          derivationPath,
          checkOnDevice: true,
          skipOpenApp: true,
        });

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "sessionId",
            deviceAction: new SendCommandInAppDeviceAction({
              input: {
                command: new GetAddressCommand({
                  derivationPath,
                  checkOnDevice: true,
                }),
                appName: APP_NAME,
                requiredUserInteraction: UserInteractionRequired.VerifyAddress,
                skipOpenApp: true,
              },
            }),
          }),
        );
      });
    });
  });

  describe("getAppConfiguration", () => {
    it("should return the app configuration", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const output: GetAppConfigurationDAOutput = {
          version: "0.5.0",
          versionN: 500,
          allowData: true,
          allowContract: true,
          truncateAddress: true,
          signByHash: true,
        };

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output,
            } as DeviceActionState<
              GetAppConfigurationDAOutput,
              GetAppConfigurationDAError,
              GetAppConfigurationDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        const { observable } = binder.getAppConfiguration();

        // THEN
        const states: DeviceActionState<
          GetAppConfigurationDAOutput,
          GetAppConfigurationDAError,
          GetAppConfigurationDAIntermediateValue
        >[] = [];
        observable.subscribe({
          next: (state) => states.push(state),
          error: reject,
          complete: () => {
            try {
              expect(states).toEqual([
                { status: DeviceActionStatus.Completed, output },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with the correct params", () => {
      // WHEN
      const binder = new TronAppBinder(mockedDmk, "sessionId");
      binder.getAppConfiguration();

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetAppConfigurationCommand(),
              appName: APP_NAME,
              requiredUserInteraction: UserInteractionRequired.None,
              skipOpenApp: false,
            },
          }),
        }),
      );
    });
  });
});
