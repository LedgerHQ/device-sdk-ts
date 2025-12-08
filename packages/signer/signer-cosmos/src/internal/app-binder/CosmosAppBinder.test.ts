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
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/index";
import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import { CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransactionDeviceAction";

describe("CosmosAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    sendCommand: vi.fn(),
    executeDeviceAction: vi.fn(),
  } as unknown as DeviceManagementKit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new CosmosAppBinder(
      {} as DeviceManagementKit,
      {} as DeviceSessionId,
    );
    expect(binder).toBeDefined();
  });

  describe("getAddress", () => {
    it("should return the address", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const address = "cosmos19r4qlagyjnzp50ngalc8sq96c6h5c3pe6v102n";
        const publicKey = new Uint8Array([0x01, 0x02, 0x03]);

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: {
                publicKey,
                address,
              },
            } as DeviceActionState<
              GetAddressDAOutput,
              GetAddressDAError,
              GetAddressDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new CosmosAppBinder(mockedDmk, "sessionId");
        const { observable } = appBinder.getAddress({
          derivationPath: "44'/118'",
          prefix: "cosmos",
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
                  output: {
                    publicKey,
                    address,
                  },
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
        derivationPath: "44'/118'/0'/0/0'",
        prefix: "cosmos",
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
        const appBinder = new CosmosAppBinder(mockedDmk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetPubKeyCommand(params),
              appName: "Cosmos",
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              skipOpenApp: false,
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
        const appBinder = new CosmosAppBinder(mockedDmk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetPubKeyCommand(params),
              appName: "Cosmos",
              requiredUserInteraction: UserInteractionRequired.None,
              skipOpenApp: false,
            },
          }),
        });
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
        const appBinder = new CosmosAppBinder(mockedDmk, "sessionId");
        const { observable } = appBinder.signTransaction({
          derivationPath: "44'/501'",
          serializedSignDoc: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
          options: { skipOpenApp: false },
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
      const serializedSignDoc = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const skipOpenApp = false;

      // WHEN
      const appBinder = new CosmosAppBinder(mockedDmk, "sessionId");
      appBinder.signTransaction({
        derivationPath,
        serializedSignDoc,
        options: { skipOpenApp: false },
      });

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
        sessionId: "sessionId",
        deviceAction: new SignTransactionDeviceAction({
          input: {
            derivationPath,
            serializedSignDoc,
            options: { skipOpenApp },
          },
        }),
      });
    });
  });
});
