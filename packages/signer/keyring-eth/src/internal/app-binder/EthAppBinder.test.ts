import { DeviceActionState, DeviceSdk } from "@ledgerhq/device-sdk-core";
import { DeviceActionStatus } from "@ledgerhq/device-sdk-core";
import { SendCommandInAppDeviceAction } from "@ledgerhq/device-sdk-core";
import { UserInteractionRequired } from "@ledgerhq/device-sdk-core";
import { from } from "rxjs";

import {
  GetAddressDAError,
  GetAddressDAIntermediateValue,
  GetAddressDAOutput,
} from "@api/app-binder/GetAddressDeviceActionTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { EthAppBinder } from "./EthAppBinder";

describe("EthAppBinder", () => {
  const mockedSdk: DeviceSdk = {
    sendCommand: jest.fn(),
    executeDeviceAction: jest.fn(),
  } as unknown as DeviceSdk;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAddress", () => {
    it("should return the address, publicKey, and chainCode", (done) => {
      // GIVEN
      const address = "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43";
      const publicKey = "04e3785ca";
      const chainCode = undefined;

      jest.spyOn(mockedSdk, "executeDeviceAction").mockReturnValue({
        observable: from([
          {
            status: DeviceActionStatus.Completed,
            output: { address, publicKey, chainCode },
          } as DeviceActionState<
            GetAddressDAOutput,
            GetAddressDAError,
            GetAddressDAIntermediateValue
          >,
        ]),
        cancel: jest.fn(),
      });

      // WHEN
      const appBinder = new EthAppBinder(mockedSdk, "sessionId");
      const { observable } = appBinder.getAddress({
        derivationPath: "44'/60'/3'/2/1",
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
                output: { address, publicKey, chainCode },
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

      test("when checkOnDevice is true: UserInteractionRequired.VerifyAddress", () => {
        // GIVEN
        const checkOnDevice = true;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new EthAppBinder(mockedSdk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedSdk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetAddressCommand(params),
              appName: "Ethereum",
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            },
          }),
        });
      });

      test("when checkOnDevice is false: UserInteractionRequired.None", () => {
        // GIVEN
        const checkOnDevice = false;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new EthAppBinder(mockedSdk, "sessionId");
        appBinder.getAddress(params);

        // THEN
        expect(mockedSdk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetAddressCommand(params),
              appName: "Ethereum",
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
        });
      });
    });
  });
});
