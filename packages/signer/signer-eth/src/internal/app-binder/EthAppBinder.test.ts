import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceActionState,
  type DeviceManagementKit,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { SendCommandInAppDeviceAction } from "@ledgerhq/device-management-kit";
import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";
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
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { ETHEREUM_PLUGINS } from "./constant/plugins";
import { EthAppBinder } from "./EthAppBinder";

describe("EthAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    sendCommand: vi.fn(),
    executeDeviceAction: vi.fn(),
  } as unknown as DeviceManagementKit;
  const mockedContextModule: ContextModule = {
    getContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getWeb3Checks: vi.fn(),
    getSolanaContext: vi.fn(),
  };
  const mockedMapper: TransactionMapperService = {
    mapTransactionToSubset: vi.fn(),
  } as unknown as TransactionMapperService;
  const mockedParser: TransactionParserService = {
    extractValue: vi.fn(),
  } as unknown as TransactionParserService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAddress", () => {
    it("should return the address, publicKey, and chainCode", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const address = "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43";
        const publicKey = "04e3785ca";
        const chainCode = undefined;

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new EthAppBinder(
          mockedDmk,
          mockedContextModule,
          mockedMapper,
          mockedParser,
          "sessionId",
        );
        const { observable } = appBinder.getAddress({
          derivationPath: "44'/60'/3'/2/1",
          checkOnDevice: false,
          returnChainCode: false,
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
                  output: { address, publicKey, chainCode },
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
        checkOnDevice: false,
        returnChainCode: false,
        skipOpenApp: false,
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
          mockedParser,
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
              compatibleAppNames: ETHEREUM_PLUGINS,
              skipOpenApp: false,
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
          mockedParser,
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
              compatibleAppNames: ETHEREUM_PLUGINS,
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
        const signature: Signature = {
          r: `0xDEAD`,
          s: `0xBEEF`,
          v: 0,
        };
        const transaction: Uint8Array = hexaStringToBuffer(
          Transaction.from({
            to: "0x1234567890123456789012345678901234567890",
            value: 0n,
          }).unsignedSerialized,
        )!;
        const options = {};

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new EthAppBinder(
          mockedDmk,
          mockedContextModule,
          mockedMapper,
          mockedParser,
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

    it("should return the signature without options", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const signature: Signature = {
          r: `0xDEAD`,
          s: `0xBEEF`,
          v: 0,
        };
        const transaction: Uint8Array = hexaStringToBuffer(
          Transaction.from({
            to: "0x1234567890123456789012345678901234567890",
            value: 0n,
          }).unsignedSerialized,
        )!;

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new EthAppBinder(
          mockedDmk,
          mockedContextModule,
          mockedMapper,
          mockedParser,
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
  });

  describe("signMessage", () => {
    it("should return the signature", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const signature: Signature = {
          r: `0xDEAD`,
          s: `0xBEEF`,
          v: 0,
        };
        const message = "Hello, World!";

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new EthAppBinder(
          mockedDmk,
          mockedContextModule,
          mockedMapper,
          mockedParser,
          "sessionId",
        );
        const { observable } = appBinder.signPersonalMessage({
          derivationPath: "44'/60'/3'/2/1",
          message,
          skipOpenApp: false,
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
  });

  describe("signTypedData", () => {
    it("should return the signature", () =>
      new Promise<void>((resolve, reject) => {
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
          parse: vi.fn(),
        };

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
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
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new EthAppBinder(
          mockedDmk,
          mockedContextModule,
          mockedMapper,
          mockedParser,
          "sessionId",
        );
        const { observable } = appBinder.signTypedData({
          derivationPath: "44'/60'/3'/2/1",
          parser,
          data: typedData,
          skipOpenApp: false,
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
  });
});
