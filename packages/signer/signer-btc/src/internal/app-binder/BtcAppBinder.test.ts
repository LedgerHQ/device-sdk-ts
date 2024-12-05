import {
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from, type Subscription } from "rxjs";

import {
  type GetExtendedDAIntermediateValue,
  type GetExtendedPublicKeyDAError,
  type GetExtendedPublicKeyDAOutput,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";

describe("BtcAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    sendCommand: jest.fn(),
    executeDeviceAction: jest.fn(),
  } as unknown as DeviceManagementKit;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new BtcAppBinder(
      {} as DeviceManagementKit,
      {} as DeviceSessionId,
    );
    expect(binder).toBeDefined();
  });

  describe("getExtendedPublicKey", () => {
    let subscription: Subscription;
    afterEach(() => {
      if (subscription) {
        subscription.unsubscribe();
      }
    });
    it("should return the pub key", (done) => {
      // GIVEN
      const extendedPublicKey = "D2PPQSYFe83nDzk96FqGumVU8JA7J8vj2Rhjc2oXzEi5";

      jest.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
        observable: from([
          {
            status: DeviceActionStatus.Completed,
            output: { extendedPublicKey },
          } as DeviceActionState<
            GetExtendedPublicKeyDAOutput,
            GetExtendedPublicKeyDAError,
            GetExtendedDAIntermediateValue
          >,
        ]),
        cancel: jest.fn(),
      });

      // WHEN
      const appBinder = new BtcAppBinder(mockedDmk, "sessionId");
      const { observable } = appBinder.getExtendedPublicKey({
        derivationPath: "44'/501'",
        checkOnDevice: false,
      });

      // THEN
      const states: DeviceActionState<
        GetExtendedPublicKeyDAOutput,
        GetExtendedPublicKeyDAError,
        GetExtendedDAIntermediateValue
      >[] = [];
      subscription = observable.subscribe({
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
                output: { extendedPublicKey },
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
        const appBinder = new BtcAppBinder(mockedDmk, "sessionId");
        appBinder.getExtendedPublicKey(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetExtendedPublicKeyCommand(params),
              appName: "Bitcoin",
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
        const appBinder = new BtcAppBinder(mockedDmk, "sessionId");
        appBinder.getExtendedPublicKey(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetExtendedPublicKeyCommand(params),
              appName: "Bitcoin",
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
        });
      });
    });
  });
});
