/* eslint @typescript-eslint/consistent-type-imports: off */
import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetWalletAddressDAState } from "@api/app-binder/GetWalletAddressDeviceActionTypes";
import { type RegisteredWallet, type WalletAddress } from "@api/model/Wallet";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { GetWalletAddressDeviceAction } from "./GetWalletAddressDeviceAction";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

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

describe("GetWalletAddressDeviceAction", () => {
  const prepareWalletPolicyMock = vi.fn();
  const getWalletAddressMock = vi.fn();

  function extractDependenciesMock() {
    return {
      prepareWalletPolicy: prepareWalletPolicyMock,
      getWalletAddress: getWalletAddressMock,
    };
  }

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<void>((resolve, reject) => {
        // given
        setupOpenAppDAMock();

        const deviceAction = new GetWalletAddressDeviceAction({
          input: {
            wallet: "ApiWallet" as unknown as RegisteredWallet,
            walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
            walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
            dataStoreService: "DataStoreService" as unknown as DataStoreService,
            skipOpenApp: false,
            checkOnDevice: true,
            change: false,
            addressIndex: 1,
          },
          loggerFactory: mockLoggerFactory,
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "InternalWallet",
          }),
        );
        getWalletAddressMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "WalletAddress",
          }),
        );

        const expectedStates: Array<GetWalletAddressDAState> = [
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
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: "WalletAddress" as unknown as WalletAddress,
            status: DeviceActionStatus.Completed,
          },
        ];

        // then
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

    it("should be successful while skipping OpenApp", () =>
      new Promise<void>((resolve, reject) => {
        // given
        setupOpenAppDAMock();

        const deviceAction = new GetWalletAddressDeviceAction({
          input: {
            wallet: "ApiWallet" as unknown as RegisteredWallet,
            walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
            walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
            dataStoreService: "DataStoreService" as unknown as DataStoreService,
            skipOpenApp: true,
            checkOnDevice: true,
            change: false,
            addressIndex: 1,
          },
          loggerFactory: mockLoggerFactory,
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "InternalWallet",
          }),
        );
        getWalletAddressMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "WalletAddress",
          }),
        );

        const expectedStates: Array<GetWalletAddressDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: "WalletAddress" as unknown as WalletAddress,
            status: DeviceActionStatus.Completed,
          },
        ];

        // then
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

  describe("Error cases", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("Error if open app fails", () =>
      new Promise<void>((resolve, reject) => {
        // given
        setupOpenAppDAMock(new UnknownDeviceExchangeError("Mocked error"));

        const expectedStates: Array<GetWalletAddressDAState> = [
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

        const deviceAction = new GetWalletAddressDeviceAction({
          input: {
            wallet: {} as unknown as RegisteredWallet,
            walletBuilder: {} as WalletBuilder,
            walletSerializer: {} as WalletSerializer,
            dataStoreService: {} as DataStoreService,
            skipOpenApp: false,
            checkOnDevice: true,
            change: false,
            addressIndex: 1,
          },
          loggerFactory: mockLoggerFactory,
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );

        // then
        expect(getWalletAddressMock).not.toHaveBeenCalled();
      }));

    it("Error if prepareWalletPolicy fails", () =>
      new Promise<void>((resolve, reject) => {
        // given
        setupOpenAppDAMock();

        const deviceAction = new GetWalletAddressDeviceAction({
          input: {
            wallet: {} as unknown as RegisteredWallet,
            walletBuilder: {} as WalletBuilder,
            walletSerializer: {} as WalletSerializer,
            dataStoreService: {} as DataStoreService,
            skipOpenApp: false,
            checkOnDevice: true,
            change: false,
            addressIndex: 1,
          },
          loggerFactory: mockLoggerFactory,
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const expectedStates: Array<GetWalletAddressDAState> = [
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

        // then
        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );

        expect(getWalletAddressMock).not.toHaveBeenCalled();
      }));

    it("Error if getWalletAddress fails", () =>
      new Promise<void>((resolve, reject) => {
        // given
        setupOpenAppDAMock();

        const deviceAction = new GetWalletAddressDeviceAction({
          input: {
            wallet: {} as unknown as RegisteredWallet,
            walletBuilder: {} as WalletBuilder,
            walletSerializer: {} as WalletSerializer,
            dataStoreService: {} as DataStoreService,
            skipOpenApp: false,
            checkOnDevice: true,
            change: false,
            addressIndex: 1,
          },
          loggerFactory: mockLoggerFactory,
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        prepareWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "InternalWallet",
          }),
        );
        getWalletAddressMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const expectedStates: Array<GetWalletAddressDAState> = [
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
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDeviceExchangeError("Mocked error"),
          },
        ];

        // then
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
