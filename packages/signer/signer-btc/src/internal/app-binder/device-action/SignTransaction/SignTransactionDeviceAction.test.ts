import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignTransactionDAState } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type RegisteredWallet } from "@api/model/Wallet";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupSignPsbtDAMock } from "@internal/app-binder/device-action/__test-utils__/setupSignPsbtDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

jest.mock(
  "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction",
  () => ({
    ...jest.requireActual(
      "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction",
    ),
    SignPsbtDeviceAction: jest.fn(() => ({
      makeStateMachine: jest.fn(),
    })),
  }),
);

describe("SignTransactionDeviceAction", () => {
  const updatePsbtMock = jest.fn();
  const extractTransactionMock = jest.fn();

  function extractDependenciesMock() {
    return {
      updatePsbt: updatePsbtMock,
      extractTransaction: extractTransactionMock,
    };
  }

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", (done) => {
      setupSignPsbtDAMock([
        {
          inputIndex: 0,
          pubkey: Uint8Array.from([0x04, 0x05, 0x06]),
          signature: Uint8Array.from([0x01, 0x02, 0x03]),
        },
      ]);

      const deviceAction = new SignTransactionDeviceAction({
        input: {
          wallet: "ApiWallet" as unknown as RegisteredWallet,
          psbt: "Hello world",
          walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
          walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
          dataStoreService: "DataStoreService" as unknown as DataStoreService,
          psbtMapper: "PsbtMapper" as unknown as PsbtMapper,
          valueParser: "ValueParser" as unknown as ValueParser,
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      updatePsbtMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: "Psbt" as unknown as InternalPsbt,
        }),
      );
      extractTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: "0x42",
        }),
      );

      // Expected intermediate values for the following state sequence:
      const expectedStates: Array<SignTransactionDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: "0x42",
          status: DeviceActionStatus.Completed,
        },
      ];

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );

      // @todo Put this in a onDone handle of testDeviceActionStates
      observable.subscribe({
        complete: () => {
          expect(updatePsbtMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                psbt: "Hello world",
                psbtMapper: "PsbtMapper",
                signatures: [
                  {
                    inputIndex: 0,
                    pubkey: Uint8Array.from([0x04, 0x05, 0x06]),
                    signature: Uint8Array.from([0x01, 0x02, 0x03]),
                  },
                ],
                valueParser: "ValueParser",
              },
            }),
          );
          expect(extractTransactionMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                psbt: "Psbt",
                valueParser: "ValueParser",
              },
            }),
          );
        },
      });
    });
  });

  describe("error cases", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it("Error if sign psbt fails", (done) => {
      setupSignPsbtDAMock([], new UnknownDeviceExchangeError("Mocked error"));

      const expectedStates: Array<SignTransactionDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDeviceExchangeError("Mocked error"),
        },
      ];

      const deviceAction = new SignTransactionDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
          walletBuilder: {} as WalletBuilder,
          walletSerializer: {} as WalletSerializer,
          dataStoreService: {} as DataStoreService,
          psbtMapper: {} as PsbtMapper,
          valueParser: {} as ValueParser,
        },
      });

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
    it("Error if update psbt fails", (done) => {
      setupSignPsbtDAMock();

      const deviceAction = new SignTransactionDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
          walletBuilder: {} as WalletBuilder,
          walletSerializer: {} as WalletSerializer,
          dataStoreService: {} as DataStoreService,
          psbtMapper: {} as PsbtMapper,
          valueParser: {} as ValueParser,
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      updatePsbtMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Mocked error"),
        }),
      );

      const expectedStates: Array<SignTransactionDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDeviceExchangeError("Mocked error"),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
    it("Error if extract transaction fails", (done) => {
      setupSignPsbtDAMock();

      const deviceAction = new SignTransactionDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
          walletBuilder: {} as WalletBuilder,
          walletSerializer: {} as WalletSerializer,
          dataStoreService: {} as DataStoreService,
          psbtMapper: {} as PsbtMapper,
          valueParser: {} as ValueParser,
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      updatePsbtMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: "Psbt" as unknown as InternalPsbt,
        }),
      );
      extractTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Mocked error"),
        }),
      );

      const expectedStates: Array<SignTransactionDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDeviceExchangeError("Mocked error"),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
  });
});
