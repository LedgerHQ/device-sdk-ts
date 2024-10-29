import {
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceSdk,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";

import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
} from "@api/index";

import { GetPubKeyCommand } from "./command/GetPubKeyCommand";
import { SolanaAppBinder } from "./SolanaAppBinder";

describe("SolanaAppBinder", () => {
  const mockedSdk: DeviceSdk = {
    sendCommand: jest.fn(),
    executeDeviceAction: jest.fn(),
  } as unknown as DeviceSdk;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new SolanaAppBinder({} as DeviceSdk, {} as DeviceSessionId);
    expect(binder).toBeDefined();
  });

  describe("getAddress", () => {
    it("should return the address", (done) => {
      // GIVEN
      const address = "D2PPQSYFe83nDzk96FqGumVU8JA7J8vj2Rhjc2oXzEi5";

      jest.spyOn(mockedSdk, "executeDeviceAction").mockReturnValue({
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
        cancel: jest.fn(),
      });

      // WHEN
      const appBinder = new SolanaAppBinder(mockedSdk, "sessionId");
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
            done(err);
          }
        },
      });
    });

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
        const appBinder = new SolanaAppBinder(mockedSdk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedSdk.executeDeviceAction).toHaveBeenCalledWith({
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
        const appBinder = new SolanaAppBinder(mockedSdk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedSdk.executeDeviceAction).toHaveBeenCalledWith({
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
});
