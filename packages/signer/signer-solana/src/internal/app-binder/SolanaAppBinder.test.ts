import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DmkError,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";

import {
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
} from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/index";

import { GetAppConfigurationCommand } from "./command/GetAppConfigurationCommand";
import { GetPubKeyCommand } from "./command/GetPubKeyCommand";
import { SignMessageDeviceAction } from "./device-action/SignMessage/SignMessageDeviceAction";
import { SignTransactionDeviceAction } from "./device-action/SignTransactionDeviceAction";
import { SolanaAppBinder } from "./SolanaAppBinder";

describe("SolanaAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    sendCommand: vi.fn(),
    executeDeviceAction: vi.fn(),
  } as unknown as DeviceManagementKit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new SolanaAppBinder(
      {} as DeviceManagementKit,
      {} as DeviceSessionId,
    );
    expect(binder).toBeDefined();
  });

  describe("getAddress", () => {
    it("should return the address", () =>
      new Promise<Error | void>((done) => {
        // GIVEN
        const address = "D2PPQSYFe83nDzk96FqGumVU8JA7J8vj2Rhjc2oXzEi5";

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: address,
            } as DeviceActionState<
              GetAddressDAOutput,
              GetAddressDAError,
              GetAddressDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
        const { observable } = appBinder.getAddress({
          derivationPath: "44'/501'",
          checkOnDevice: false,
        });

        // THEN
        const states: DeviceActionState<
          GetAddressDAOutput,
          GetAddressDAError,
          GetAddressDAIntermediateValue
        >[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            done(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: address,
                },
              ]);
              done();
            } catch (err) {
              done(err as Error);
            }
          },
        });
      }));

    describe("calls of executeDeviceAction with the correct params", () => {
      const baseParams = {
        derivationPath: "44'/60'/3'/2/1",
        returnChainCode: false,
      };

      it("when checkOnDevice is true: UserInteractionRequired.VerifyAddress", () => {
        // GIVEN
        const checkOnDevice = true;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetPubKeyCommand(params),
              appName: "Solana",
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            },
          }),
        });
      });

      it("when checkOnDevice is false: UserInteractionRequired.None", () => {
        // GIVEN
        const checkOnDevice = false;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetPubKeyCommand(params),
              appName: "Solana",
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
        });
      });
    });
  });

  describe("signTransaction", () => {
    it("should return the signature", () =>
      new Promise<Error | void>((done) => {
        // GIVEN
        const signature = new Uint8Array([0x01, 0x02, 0x03]);

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: signature,
            } as DeviceActionState<
              SignTransactionDAOutput,
              SignTransactionDAError,
              SignTransactionDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
        const { observable } = appBinder.signTransaction({
          derivationPath: "44'/501'",
          transaction: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
        });

        // THEN
        const states: DeviceActionState<
          SignTransactionDAOutput,
          SignTransactionDAError,
          SignTransactionDAIntermediateValue
        >[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            done(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: signature,
                },
              ]);
              done();
            } catch (err) {
              done(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with the correct params", () => {
      // GIVEN
      const derivationPath = "44'/60'/3'/2/1";
      const transaction = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      // WHEN
      const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
      appBinder.signTransaction({ derivationPath, transaction });

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
        deviceAction: new SignTransactionDeviceAction({
          input: {
            derivationPath,
            transaction,
            options: {},
          },
        }),
        sessionId: "sessionId",
      });
    });
  });

  describe("signMessage", () => {
    it("should return the signed message", () =>
      new Promise<Error | void>((done) => {
        // GIVEN
        const signedMessage = new Uint8Array([0x1c, 0x8a, 0x54, 0x05, 0x10]);
        const signMessageArgs = {
          derivationPath: "44'/501'/0'/0'",
          message: "Hello world",
        };

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: signedMessage,
            } as DeviceActionState<
              Uint8Array,
              DmkError,
              DeviceActionIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
        const { observable } = appBinder.signMessage(signMessageArgs);

        // THEN
        const states: DeviceActionState<Uint8Array, unknown, unknown>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            done(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: signedMessage,
                },
              ]);
              done();
            } catch (err) {
              done(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with correct parameters", () => {
      // GIVEN
      const signMessageArgs = {
        derivationPath: "44'/501'/0'/0'",
        message: "Hello world",
      };

      // WHEN
      const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
      appBinder.signMessage(signMessageArgs);

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
        sessionId: "sessionId",
        deviceAction: new SignMessageDeviceAction({
          input: {
            derivationPath: signMessageArgs.derivationPath,
            message: signMessageArgs.message,
          },
        }),
      });
    });
  });

  describe("getAppConfiguration", () => {
    it("should return the app configuration", () =>
      new Promise<Error | void>((done) => {
        // GIVEN
        const appConfiguration = {
          blindSigningEnabled: true,
          pubKeyDisplayMode: "LONG",
          version: "2.5.10",
        };

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: appConfiguration,
            } as DeviceActionState<
              GetAppConfigurationDAOutput,
              GetAppConfigurationDAError,
              GetAppConfigurationDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");
        const { observable } = appBinder.getAppConfiguration();

        // THEN
        const states: DeviceActionState<
          GetAppConfigurationDAOutput,
          GetAppConfigurationDAError,
          GetAppConfigurationDAIntermediateValue
        >[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            done(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: appConfiguration,
                },
              ]);
              done();
            } catch (err) {
              done(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with the correct params", () => {
      // GIVEN
      const appBinder = new SolanaAppBinder(mockedDmk, "sessionId");

      // WHEN
      appBinder.getAppConfiguration();

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
        sessionId: "sessionId",
        deviceAction: new SendCommandInAppDeviceAction({
          input: {
            command: new GetAppConfigurationCommand(), // Correct command
            appName: "Solana",
            requiredUserInteraction: UserInteractionRequired.None,
          },
        }),
      });
    });
  });
});
