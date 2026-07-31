import { type ContextModule } from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
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
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
} from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type SignMessageDAOutput,
  SignMessageVersion,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type SolanaAppErrorCodes,
} from "@api/index";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import { GetAppConfigurationCommand } from "./command/GetAppConfigurationCommand";
import { GetPubKeyCommand } from "./command/GetPubKeyCommand";
import { BlockhashService } from "./services/BlockhashService";
import { APP_NAME } from "./constants";
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
      undefined,
      new BlockhashService(),
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
          undefined,
          new BlockhashService(),
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
          undefined,
          new BlockhashService(),
        );
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "sessionId",
            deviceAction: expect.objectContaining({
              input: {
                command: new GetPubKeyCommand({
                  derivationPath: params.derivationPath,
                  checkOnDevice,
                }),
                appName: APP_NAME,
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
          undefined,
          new BlockhashService(),
        );
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "sessionId",
            deviceAction: expect.objectContaining({
              input: {
                command: new GetPubKeyCommand({
                  derivationPath: params.derivationPath,
                  checkOnDevice,
                }),
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
          undefined,
          new BlockhashService(),
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
        undefined,
        new BlockhashService(),
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
            input: expect.objectContaining({
              derivationPath,
              transaction,
              transactionOptions: { skipOpenApp },
              contextModule: contextModuleStub,
            }),
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
          undefined,
          new BlockhashService(),
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

    it("passes signers into the V1 OCM via the task closure", async () => {
      const signers = [new Uint8Array(32).fill(0x22)];
      const userPubkey = new Uint8Array(32).fill(0x11);
      const rawSig = new Uint8Array(64).fill(0xaa);

      (
        mockedDmk.executeDeviceAction as ReturnType<typeof vi.fn>
      ).mockReturnValueOnce({ observable: from([]), cancel: vi.fn() });

      const appBinder = new SolanaAppBinder(
        mockedDmk,
        "sessionId",
        contextModuleStub,
        mockLoggerFactory,
        undefined,
        new BlockhashService(),
      );

      appBinder.signMessage({
        derivationPath: "44'/501'/0'/0'",
        message: "hi",
        skipOpenApp: false,
        version: SignMessageVersion.V1,
        signers,
      });

      type TaskFn = (api: {
        sendCommand: ReturnType<typeof vi.fn>;
      }) => Promise<CommandResult<{ signature: string }, SolanaAppErrorCodes>>;
      type DeviceActionArg = { deviceAction: { input: { task: TaskFn } } };

      const taskFn = (
        vi.mocked(mockedDmk.executeDeviceAction).mock
          .calls[0]![0] as DeviceActionArg
      ).deviceAction.input.task;
      const mockSendCommand = vi
        .fn()
        .mockResolvedValueOnce(
          CommandResultFactory({ data: DefaultBs58Encoder.encode(userPubkey) }),
        )
        .mockResolvedValueOnce(CommandResultFactory({ data: rawSig }));

      const result = await taskFn({ sendCommand: mockSendCommand });

      expect("data" in result).toBe(true);
      if (!("data" in result)) throw new Error("expected data result");
      const envelope = DefaultBs58Encoder.decode(result.data.signature);
      const ocm = envelope.slice(65);
      expect(ocm[16]).toBe(1); // V1 version byte
      expect(ocm[17]).toBe(2); // 2 signers: userPubkey + extra
      // userPubkey (0x11) < signers[0] (0x22) → sorted: userPubkey first
      expect(ocm.slice(18, 50)).toEqual(userPubkey);
      expect(ocm.slice(50, 82)).toEqual(signers[0]);
    });

    it("should accept a Uint8Array message for Raw pass-through", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const signedMessage = { signature: "rawSig" };
        const binaryPayload = new Uint8Array([0xff, 0x01, 0x02]);

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
          undefined,
          new BlockhashService(),
        );
        const { observable } = appBinder.signMessage({
          derivationPath: "44'/501'/0'/0'",
          message: binaryPayload,
          skipOpenApp: false,
        });

        // THEN
        const states: DeviceActionState<
          SignMessageDAOutput,
          unknown,
          unknown
        >[] = [];
        observable.subscribe({
          next: (state) => states.push(state),
          error: (err) => reject(err),
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
          undefined,
          new BlockhashService(),
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
        undefined,
        new BlockhashService(),
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
