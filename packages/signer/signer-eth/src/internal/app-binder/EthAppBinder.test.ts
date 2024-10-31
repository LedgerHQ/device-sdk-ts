import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceActionState,
  type DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { SendCommandInAppDeviceAction } from "@ledgerhq/device-management-kit";
import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers-v6";
import { from } from "rxjs";

import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
} from "@api/app-binder/GetAddressDeviceActionTypes";
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
  type SignTypedDataDAError,
  type SignTypedDataDAIntermediateValue,
  type SignTypedDataDAOutput,
} from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { EthAppBinder } from "./EthAppBinder";

describe("EthAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    sendCommand: jest.fn(),
    executeDeviceAction: jest.fn(),
  } as unknown as DeviceManagementKit;
  const mockedContextModule: ContextModule = {
    getContexts: jest.fn(),
    getTypedDataFilters: jest.fn(),
  };
  const mockedMapper: TransactionMapperService = {
    mapTransactionToSubset: jest.fn(),
  } as unknown as TransactionMapperService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAddress", () => {
    it("should return the address, publicKey, and chainCode", (done) => {
      // GIVEN
      const address = "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43";
      const publicKey = "04e3785ca";
      const chainCode = undefined;

      jest.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
        mockedDmk,
        mockedContextModule,
        mockedMapper,
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
          mockedDmk,
          mockedContextModule,
          mockedMapper,
          "sessionId",
        );
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
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
          mockedDmk,
          mockedContextModule,
          mockedMapper,
          "sessionId",
        );
        appBinder.getAddress(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
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

  describe("signTransaction", () => {
    it("should return the signature", (done) => {
      // GIVEN
      const signature: Signature = {
        r: `0xDEAD`,
        s: `0xBEEF`,
        v: 0,
      };
      const transaction: Transaction = new Transaction();
      transaction.to = "0x1234567890123456789012345678901234567890";
      transaction.value = 0n;
      const options = {};

      jest.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
        mockedDmk,
        mockedContextModule,
        mockedMapper,
        "sessionId",
      );
      const { observable } = appBinder.signTransaction({
        derivationPath: "44'/60'/3'/2/1",
        transaction,
        options,
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
            done(err);
          }
        },
      });
    });

    it("should return the signature without options", (done) => {
      // GIVEN
      const signature: Signature = {
        r: `0xDEAD`,
        s: `0xBEEF`,
        v: 0,
      };
      const transaction: Transaction = new Transaction();
      transaction.to = "0x1234567890123456789012345678901234567890";
      transaction.value = 0n;

      jest.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
        mockedDmk,
        mockedContextModule,
        mockedMapper,
        "sessionId",
      );
      const { observable } = appBinder.signTransaction({
        derivationPath: "44'/60'/3'/2/1",
        transaction,
        options: undefined,
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
            done(err);
          }
        },
      });
    });
  });

  describe("signMessage", () => {
    it("should return the signature", (done) => {
      // GIVEN
      const signature: Signature = {
        r: `0xDEAD`,
        s: `0xBEEF`,
        v: 0,
      };
      const message = "Hello, World!";

      jest.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
        observable: from([
          {
            status: DeviceActionStatus.Completed,
            output: signature,
          } as DeviceActionState<
            SignPersonalMessageDAOutput,
            SignPersonalMessageDAError,
            SignPersonalMessageDAIntermediateValue
          >,
        ]),
        cancel: jest.fn(),
      });

      // WHEN
      const appBinder = new EthAppBinder(
        mockedDmk,
        mockedContextModule,
        mockedMapper,
        "sessionId",
      );
      const { observable } = appBinder.signPersonalMessage({
        derivationPath: "44'/60'/3'/2/1",
        message,
      });

      // THEN
      const states: DeviceActionState<
        SignPersonalMessageDAOutput,
        SignPersonalMessageDAError,
        SignPersonalMessageDAIntermediateValue
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

      jest.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
        mockedDmk,
        mockedContextModule,
        mockedMapper,
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
