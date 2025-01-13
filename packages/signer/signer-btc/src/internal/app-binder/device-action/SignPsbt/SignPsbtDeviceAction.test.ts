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

jest.mock(
  "@ledgerhq/device-management-kit",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  () => ({
    ...jest.requireActual("@ledgerhq/device-management-kit"),
    OpenAppDeviceAction: jest.fn(() => ({
      makeStateMachine: jest.fn(),
    })),
  }),
);

describe("SignPsbtDeviceAction", () => {
  const signPsbtMock = jest.fn();
  const prepareWalletPolicyMock = jest.fn();
  const buildPsbtMock = jest.fn();

  function extractDependenciesMock() {
    return {
      signPsbt: signPsbtMock,
      prepareWalletPolicy: prepareWalletPolicyMock,
      buildPsbt: buildPsbtMock,
    };
  }

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", (done) => {
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
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
              pubKeyAugmented: Uint8Array.from([0x04, 0x05, 0x06]),
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
              pubKeyAugmented: Uint8Array.from([0x04, 0x05, 0x06]),
              signature: Uint8Array.from([0x01, 0x02, 0x03]),
            },
          ],
          status: DeviceActionStatus.Completed,
        },
      ];

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
      );

      // Verify mocks calls parameters
      observable.subscribe({
        complete: () => {
          expect(prepareWalletPolicyMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: { wallet: "ApiWallet", walletBuilder: "WalletBuilder" },
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
          done();
        },
      });
    });
  });

  describe("error cases", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it("Error if open app fails", (done) => {
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
        },
      });

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("Error if prepareWallet fails", (done) => {
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
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );
    });

    it("Error if buildPsbt fails", (done) => {
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
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );
    });

    it("Error if signPsbt fails", (done) => {
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
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );
    });

    it("Error if signPsbt throws an exception", (done) => {
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
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );
    });

    it("Return a Left if the final state has no signature", (done) => {
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
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );
    });
  });
});
