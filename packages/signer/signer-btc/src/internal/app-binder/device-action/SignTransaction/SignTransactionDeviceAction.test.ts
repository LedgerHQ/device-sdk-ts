/* eslint @typescript-eslint/consistent-type-imports: off */
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

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

vi.mock(
  "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction")
      >();
    return {
      ...original,
      SignPsbtDeviceAction: vi.fn(() => ({
        makeStateMachine: vi.fn(),
      })),
    };
  },
);

describe("SignTransactionDeviceAction", () => {
  const updatePsbtMock = vi.fn();
  const extractTransactionMock = vi.fn();

  function extractDependenciesMock() {
    return {
      updatePsbt: updatePsbtMock,
      extractTransaction: extractTransactionMock,
    };
  }

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<void>((resolve, reject) => {
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
            skipOpenApp: false,
          },
          loggerFactory: mockLoggerFactory,
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
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
              resolve();
            },
            onError: reject,
          },
        );
      }));
  });

  describe("error cases", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });
    it("Error if sign psbt fails", () =>
      new Promise<void>((resolve, reject) => {
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
            skipOpenApp: false,
          },
          loggerFactory: mockLoggerFactory,
        });

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("Error if update psbt fails", () =>
      new Promise<void>((resolve, reject) => {
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
            skipOpenApp: false,
          },
          loggerFactory: mockLoggerFactory,
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("Error if extract transaction fails", () =>
      new Promise<void>((resolve, reject) => {
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
            skipOpenApp: false,
          },
          loggerFactory: mockLoggerFactory,
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });
});
