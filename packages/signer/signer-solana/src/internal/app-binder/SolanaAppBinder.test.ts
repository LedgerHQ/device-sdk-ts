import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DmkError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";

import {
  type GenerateTransactionDAError,
  type GenerateTransactionDAIntermediateValue,
  type GenerateTransactionDAOutput,
} from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import {
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
} from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type SignMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/index";

import { GetAppConfigurationCommand } from "./command/GetAppConfigurationCommand";
import { GetPubKeyCommand } from "./command/GetPubKeyCommand";
import { GenerateTransactionDeviceAction } from "./device-action/GenerateTransactionDeviceAction";
import { SolanaAppBinder } from "./SolanaAppBinder";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("SolanaAppBinder", () => {
  // stub ContextModule for tests
  const contextModuleStub: ContextModule = {} as ContextModule;

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
      contextModuleStub,
      mockLoggerFactory,
    );
    expect(binder).toBeDefined();
  });

  describe("getAddress", () => {
    it("should return the address", () =>
      new Promise<void>((resolve, reject) => {
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
        const appBinder = new SolanaAppBinder(
          mockedDmk,
          "sessionId",
          contextModuleStub,
          mockLoggerFactory,
        );
        const { observable } = appBinder.getAddress({
          derivationPath: "44'/501'",
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
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: address,
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    describe("calls of executeDeviceAction with the correct params", () => {
      const baseParams = {
        derivationPath: "44'/60'/3'/2/1",
        returnChainCode: false,
        skipOpenApp: false,
      };

      it("when checkOnDevice is true: UserInteractionRequired.VerifyAddress", () => {
        // GIVEN
        const checkOnDevice = true;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new SolanaAppBinder(
          mockedDmk,
          "sessionId",
          contextModuleStub,
          mockLoggerFactory,
        );
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "sessionId",
            deviceAction: expect.objectContaining({
              input: {
                command: new GetPubKeyCommand(params),
                appName: "Solana",
                requiredUserInteraction: UserInteractionRequired.VerifyAddress,
                skipOpenApp: false,
              },
            }),
          }),
        );
      });

      it("when checkOnDevice is false: UserInteractionRequired.None", () => {
        // GIVEN
        const checkOnDevice = false;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new SolanaAppBinder(
          mockedDmk,
          "sessionId",
          contextModuleStub,
          mockLoggerFactory,
        );
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "sessionId",
            deviceAction: expect.objectContaining({
              input: {
                command: new GetPubKeyCommand(params),
                appName: "Solana",
                requiredUserInteraction: UserInteractionRequired.None,
                skipOpenApp: false,
              },
            }),
          }),
        );
      });
    });
  });

  describe("signTransaction", () => {
    it("should return the signature", () =>
      new Promise<void>((resolve, reject) => {
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
        const appBinder = new SolanaAppBinder(
          mockedDmk,
          "sessionId",
          contextModuleStub,
          mockLoggerFactory,
        );
        const { observable } = appBinder.signTransaction({
          derivationPath: "44'/501'",
          transaction: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
          solanaTransactionOptionalConfig: { skipOpenApp: false },
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
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: signature,
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with the correct params", () => {
      // GIVEN
      const derivationPath = "44'/60'/3'/2/1";
      const transaction = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const skipOpenApp = false;

      // WHEN
      const appBinder = new SolanaAppBinder(
        mockedDmk,
        "sessionId",
        contextModuleStub,
        mockLoggerFactory,
      );
      appBinder.signTransaction({
        derivationPath,
        transaction,
        solanaTransactionOptionalConfig: { skipOpenApp: false },
      });

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sessionId",
          deviceAction: expect.objectContaining({
            input: {
              derivationPath,
              transaction,
              transactionOptions: { skipOpenApp },
              contextModule: contextModuleStub,
            },
          }),
        }),
      );
    });
  });

  describe("signMessage", () => {
    it("should return the signed message", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const signedMessage = {
          signature: "signature",
        };
        const signMessageArgs = {
          derivationPath: "44'/501'/0'/0'",
          message: "Hello world",
          skipOpenApp: false,
        };

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: signedMessage,
            } as DeviceActionState<
              SignMessageDAOutput,
              DmkError,
              DeviceActionIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new SolanaAppBinder(
          mockedDmk,
          "sessionId",
          contextModuleStub,
          mockLoggerFactory,
        );
        const { observable } = appBinder.signMessage(signMessageArgs);

        // THEN
        const states: DeviceActionState<
          SignMessageDAOutput,
          unknown,
          unknown
        >[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: signedMessage,
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));
  });

  describe("getAppConfiguration", () => {
    it("should return the app configuration", () =>
      new Promise<void>((resolve, reject) => {
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
        const appBinder = new SolanaAppBinder(
          mockedDmk,
          "sessionId",
          contextModuleStub,
          mockLoggerFactory,
        );
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
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: appConfiguration,
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with the correct params", () => {
      // GIVEN
      const appBinder = new SolanaAppBinder(
        mockedDmk,
        "sessionId",
        contextModuleStub,
        mockLoggerFactory,
      );

      // WHEN
      appBinder.getAppConfiguration();

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sessionId",
          deviceAction: expect.objectContaining({
            input: {
              command: new GetAppConfigurationCommand(),
              appName: "Solana",
              requiredUserInteraction: UserInteractionRequired.None,
              skipOpenApp: false,
            },
          }),
        }),
      );
    });
  });

  describe("generateTransaction", () => {
    it("should return the serialized transaction", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const serializedTx = "BASE64_OR_HEX_TX";

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: serializedTx,
            } as DeviceActionState<
              GenerateTransactionDAOutput,
              GenerateTransactionDAError,
              GenerateTransactionDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new SolanaAppBinder(
          mockedDmk,
          "sessionId",
          contextModuleStub,
          mockLoggerFactory,
        );
        const { observable } = appBinder.generateTransaction({
          derivationPath: "44'/501'/0'/0'",
          skipOpenApp: false,
        });

        // THEN
        const states: DeviceActionState<
          GenerateTransactionDAOutput,
          GenerateTransactionDAError,
          GenerateTransactionDAIntermediateValue
        >[] = [];
        observable.subscribe({
          next: (state) => states.push(state),
          error: (err) => reject(err),
          complete: () => {
            try {
              expect(states).toEqual([
                { status: DeviceActionStatus.Completed, output: serializedTx },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with the correct params", () => {
      // GIVEN
      const derivationPath = "44'/501'/0'/0'";
      const skipOpenApp = true;

      // WHEN
      const appBinder = new SolanaAppBinder(
        mockedDmk,
        "sessionId",
        contextModuleStub,
        mockLoggerFactory,
      );
      appBinder.generateTransaction({ derivationPath, skipOpenApp });

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
        sessionId: "sessionId",
        deviceAction: new GenerateTransactionDeviceAction({
          input: {
            derivationPath,
            skipOpenApp,
            contextModule: contextModuleStub,
          },
        }),
      });
    });
  });
});
