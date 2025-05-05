/* eslint @typescript-eslint/consistent-type-imports: off */
import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { UnknownDAError } from "@ledgerhq/device-management-kit";
import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";

import { type SignPsbtDAState } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type RegisteredWallet } from "@api/model/Wallet";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type BuildPsbtTaskResult } from "@internal/app-binder/task/BuildPsbtTask";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type Wallet } from "@internal/wallet/model/Wallet";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { SignPsbtDeviceAction } from "./SignPsbtDeviceAction";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

describe("SignPsbtDeviceAction", () => {
  const signPsbtMock = vi.fn();
  const prepareWalletPolicyMock = vi.fn();
  const buildPsbtMock = vi.fn();

  function extractDependenciesMock() {
    return {
      signPsbt: signPsbtMock,
      prepareWalletPolicy: prepareWalletPolicyMock,
      buildPsbt: buildPsbtMock,
    };
  }

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        const deviceAction = new SignPsbtDeviceAction({
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
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "Wallet" as unknown as Wallet,
          }),
        );
        buildPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "BuildPsbtResult" as unknown as BuildPsbtTaskResult,
          }),
        );
        signPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: [
              {
                inputIndex: 0,
                pubkey: Uint8Array.from([0x04, 0x05, 0x06]),
                signature: Uint8Array.from([0x01, 0x02, 0x03]),
              },
            ],
          }),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> PrepareWalletPolicy -> BuildPsbt -> SignPsbt
        const expectedStates: Array<SignPsbtDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
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
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: [
              {
                inputIndex: 0,
                pubkey: Uint8Array.from([0x04, 0x05, 0x06]),
                signature: Uint8Array.from([0x01, 0x02, 0x03]),
              },
            ],
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
              expect(prepareWalletPolicyMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    wallet: "ApiWallet",
                    walletBuilder: "WalletBuilder",
                  },
                }),
              );

              expect(buildPsbtMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    psbt: "Hello world",
                    wallet: "Wallet",
                    dataStoreService: "DataStoreService",
                    psbtMapper: "PsbtMapper",
                  },
                }),
              );

              expect(signPsbtMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    wallet: "Wallet",
                    buildPsbtResult: "BuildPsbtResult",
                    walletSerializer: "WalletSerializer",
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

    it("should be successful while skipping OpenApp", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        const deviceAction = new SignPsbtDeviceAction({
          input: {
            wallet: "ApiWallet" as unknown as RegisteredWallet,
            psbt: "Hello world",
            walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
            walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
            dataStoreService: "DataStoreService" as unknown as DataStoreService,
            psbtMapper: "PsbtMapper" as unknown as PsbtMapper,
            valueParser: "ValueParser" as unknown as ValueParser,
            skipOpenApp: true,
          },
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "Wallet" as unknown as Wallet,
          }),
        );
        buildPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "BuildPsbtResult" as unknown as BuildPsbtTaskResult,
          }),
        );
        signPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: [
              {
                inputIndex: 0,
                pubkey: Uint8Array.from([0x04, 0x05, 0x06]),
                signature: Uint8Array.from([0x01, 0x02, 0x03]),
              },
            ],
          }),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> PrepareWalletPolicy -> BuildPsbt -> SignPsbt
        const expectedStates: Array<SignPsbtDAState> = [
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
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: [
              {
                inputIndex: 0,
                pubkey: Uint8Array.from([0x04, 0x05, 0x06]),
                signature: Uint8Array.from([0x01, 0x02, 0x03]),
              },
            ],
            status: DeviceActionStatus.Completed,
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

  describe("error cases", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });
    it("Error if open app fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock(new UnknownDeviceExchangeError("Mocked error"));

        const expectedStates: Array<SignPsbtDAState> = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDeviceExchangeError("Mocked error"),
          },
        ];

        const deviceAction = new SignPsbtDeviceAction({
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

    it("Error if prepareWallet fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        const deviceAction = new SignPsbtDeviceAction({
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
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const expectedStates: Array<SignPsbtDAState> = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
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

    it("Error if buildPsbt fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        const deviceAction = new SignPsbtDeviceAction({
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
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {} as Wallet,
          }),
        );
        buildPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const expectedStates: Array<SignPsbtDAState> = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
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

    it("Error if signPsbt fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        const deviceAction = new SignPsbtDeviceAction({
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
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {} as Wallet,
          }),
        );
        buildPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {} as BuildPsbtTaskResult,
          }),
        );
        signPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const expectedStates: Array<SignPsbtDAState> = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
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

    it("Error if signPsbt throws an exception", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        const deviceAction = new SignPsbtDeviceAction({
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
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({ data: {} as Wallet }),
        );
        buildPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({ data: {} as BuildPsbtTaskResult }),
        );
        signPsbtMock.mockRejectedValueOnce(
          new InvalidStatusWordError("Mocked error"),
        );

        const expectedStates: Array<SignPsbtDAState> = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
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
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new InvalidStatusWordError("Mocked error"),
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

    it("Return a Left if the final state has no signature", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        const deviceAction = new SignPsbtDeviceAction({
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
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {} as Wallet,
          }),
        );
        buildPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {} as BuildPsbtTaskResult,
          }),
        );
        signPsbtMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: undefined,
          }),
        );

        const expectedStates: Array<SignPsbtDAState> = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
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
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("No error in final state"),
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
