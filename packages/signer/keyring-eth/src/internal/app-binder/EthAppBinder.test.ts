import { type ContextModule } from "@ledgerhq/context-module";
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
import {
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue,
  SignTypedDataDAOutput,
} from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { EthAppBinder } from "./EthAppBinder";

describe("EthAppBinder", () => {
  const mockedSdk: DeviceSdk = {
    sendCommand: jest.fn(),
    executeDeviceAction: jest.fn(),
  } as unknown as DeviceSdk;
  const mockedContextModule: ContextModule = {
    getContexts: jest.fn(),
    getTypedDataFilters: jest.fn(),
  };

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
      const appBinder = new EthAppBinder(
        mockedSdk,
        mockedContextModule,
        "sessionId",
      );
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
        const appBinder = new EthAppBinder(
          mockedSdk,
          mockedContextModule,
          "sessionId",
        );
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
        const appBinder = new EthAppBinder(
          mockedSdk,
          mockedContextModule,
          "sessionId",
        );
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

  describe("signTypedData", () => {
    it("should return the signature", (done) => {
      // GIVEN
      const signature: Signature = {
        r: `0xDEAD`,
        s: `0xBEEF`,
        v: 0,
      };
      const typedData: TypedData = {
        domain: {},
        types: {},
        primaryType: "test",
        message: {},
      };
      const parser: TypedDataParserService = {
        parse: jest.fn(),
      };

      jest.spyOn(mockedSdk, "executeDeviceAction").mockReturnValue({
        observable: from([
          {
            status: DeviceActionStatus.Completed,
            output: signature,
          } as DeviceActionState<
            SignTypedDataDAOutput,
            SignTypedDataDAError,
            SignTypedDataDAIntermediateValue
          >,
        ]),
        cancel: jest.fn(),
      });

      // WHEN
      const appBinder = new EthAppBinder(
        mockedSdk,
        mockedContextModule,
        "sessionId",
      );
      const { observable } = appBinder.signTypedData({
        derivationPath: "44'/60'/3'/2/1",
        parser,
        data: typedData,
      });

      // THEN
      const states: DeviceActionState<
        SignTypedDataDAOutput,
        SignTypedDataDAError,
        SignTypedDataDAIntermediateValue
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
            done(err);
          }
        },
      });
    });
  });
});
