import {
  CallTaskInAppDeviceAction,
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
import {
  type SignPersonalMessageDAError,
  type SignPersonalMessageDAIntermediateValue,
  type SignPersonalMessageDAOutput,
} from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  type SignTransactionHashDAError,
  type SignTransactionHashDAIntermediateValue,
  type SignTransactionHashDAOutput,
} from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignTransactionHashCommand } from "@internal/app-binder/command/SignTransactionHashCommand";
import { type TronAppCommandError } from "@internal/app-binder/command/utils/tronApplicationErrors";
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

  describe("signTransaction", () => {
    const derivationPath = "44'/195'/0'/0/0";
    const transaction = Uint8Array.from([0x0a, 0x01, 0x00]);

    it("should return the signature", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const output: SignTransactionDAOutput = new Uint8Array(65).fill(0xab);

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output,
            } as DeviceActionState<
              SignTransactionDAOutput,
              SignTransactionDAError,
              SignTransactionDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        const { observable } = binder.signTransaction({
          derivationPath,
          transaction,
        });

        // THEN
        const states: DeviceActionState<
          SignTransactionDAOutput,
          SignTransactionDAError,
          SignTransactionDAIntermediateValue
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
      // The task closure breaks reference equality, so the device action is
      // asserted field by field instead of with toHaveBeenCalledWith.
      const executedDeviceAction = () => {
        const args = vi.mocked(mockedDmk.executeDeviceAction).mock
          .calls[0]![0]!;
        expect(args.sessionId).toBe("sessionId");
        expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
        return args.deviceAction as CallTaskInAppDeviceAction<
          SignTransactionDAOutput,
          TronAppCommandError,
          UserInteractionRequired.SignTransaction
        >;
      };

      it("requires the SignTransaction interaction", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.signTransaction({
          derivationPath,
          transaction,
          skipOpenApp: true,
        });

        // THEN
        const deviceAction = executedDeviceAction();
        expect(deviceAction.input.appName).toBe(APP_NAME);
        expect(deviceAction.input.requiredUserInteraction).toBe(
          UserInteractionRequired.SignTransaction,
        );
        expect(deviceAction.input.skipOpenApp).toBe(true);
      });

      it("defaults skipOpenApp to false", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.signTransaction({ derivationPath, transaction });

        // THEN
        expect(executedDeviceAction().input.skipOpenApp).toBe(false);
      });
    });
  });

  describe("signTransactionHash", () => {
    const derivationPath = "44'/195'/0'/0/0";
    const transactionHash = new Uint8Array(32).fill(0x25);

    it("should return the signature", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const output: SignTransactionHashDAOutput = new Uint8Array(65).fill(
          0xab,
        );

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output,
            } as DeviceActionState<
              SignTransactionHashDAOutput,
              SignTransactionHashDAError,
              SignTransactionHashDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        const { observable } = binder.signTransactionHash({
          derivationPath,
          transactionHash,
        });

        // THEN
        const states: DeviceActionState<
          SignTransactionHashDAOutput,
          SignTransactionHashDAError,
          SignTransactionHashDAIntermediateValue
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
      it("requires the SignTransaction interaction", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.signTransactionHash({
          derivationPath,
          transactionHash,
          skipOpenApp: true,
        });

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "sessionId",
            deviceAction: new SendCommandInAppDeviceAction({
              input: {
                command: new SignTransactionHashCommand({
                  derivationPath,
                  transactionHash,
                }),
                appName: APP_NAME,
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                skipOpenApp: true,
              },
            }),
          }),
        );
      });

      it("defaults skipOpenApp to false", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.signTransactionHash({ derivationPath, transactionHash });

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceAction: new SendCommandInAppDeviceAction({
              input: {
                command: new SignTransactionHashCommand({
                  derivationPath,
                  transactionHash,
                }),
                appName: APP_NAME,
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                skipOpenApp: false,
              },
            }),
          }),
        );
      });
    });
  });

  describe("signPersonalMessage", () => {
    const derivationPath = "44'/195'/0'/0/0";
    const message = Uint8Array.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]);

    it("should return the signature", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const output: SignPersonalMessageDAOutput = new Uint8Array(65).fill(
          0xab,
        );

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output,
            } as DeviceActionState<
              SignPersonalMessageDAOutput,
              SignPersonalMessageDAError,
              SignPersonalMessageDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        const { observable } = binder.signPersonalMessage({
          derivationPath,
          message,
        });

        // THEN
        const states: DeviceActionState<
          SignPersonalMessageDAOutput,
          SignPersonalMessageDAError,
          SignPersonalMessageDAIntermediateValue
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
      // The task closure breaks reference equality, so the device action is
      // asserted field by field instead of with toHaveBeenCalledWith.
      const executedDeviceAction = () => {
        const args = vi.mocked(mockedDmk.executeDeviceAction).mock
          .calls[0]![0]!;
        expect(args.sessionId).toBe("sessionId");
        expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
        return args.deviceAction as CallTaskInAppDeviceAction<
          SignPersonalMessageDAOutput,
          TronAppCommandError,
          UserInteractionRequired.SignPersonalMessage
        >;
      };

      it("requires the SignPersonalMessage interaction", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.signPersonalMessage({
          derivationPath,
          message,
          skipOpenApp: true,
        });

        // THEN
        const deviceAction = executedDeviceAction();
        expect(deviceAction.input.appName).toBe(APP_NAME);
        expect(deviceAction.input.requiredUserInteraction).toBe(
          UserInteractionRequired.SignPersonalMessage,
        );
        expect(deviceAction.input.skipOpenApp).toBe(true);
      });

      it("defaults skipOpenApp to false", () => {
        // WHEN
        const binder = new TronAppBinder(mockedDmk, "sessionId");
        binder.signPersonalMessage({ derivationPath, message });

        // THEN
        expect(executedDeviceAction().input.skipOpenApp).toBe(false);
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
