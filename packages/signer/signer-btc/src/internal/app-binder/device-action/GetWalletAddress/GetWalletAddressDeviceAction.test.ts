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

jest.mock("@ledgerhq/device-management-kit", () => ({
  ...jest.requireActual("@ledgerhq/device-management-kit"),
  OpenAppDeviceAction: jest.fn(() => ({
    makeStateMachine: jest.fn(),
  })),
}));

describe("GetWalletAddressDeviceAction", () => {
  const prepareWalletPolicyMock = jest.fn();
  const getWalletAddressMock = jest.fn();

  function extractDependenciesMock() {
    return {
      prepareWalletPolicy: prepareWalletPolicyMock,
      getWalletAddress: getWalletAddressMock,
    };
  }

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", (done) => {
      // given
      setupOpenAppDAMock();

      const deviceAction = new GetWalletAddressDeviceAction({
        input: {
          wallet: "ApiWallet" as unknown as RegisteredWallet,
          walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
          walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
          dataStoreService: "DataStoreService" as unknown as DataStoreService,
          checkOnDevice: true,
          change: false,
          addressIndex: 1,
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );
    });
  });

  describe("Error cases", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it("Error if open app fails", (done) => {
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
          checkOnDevice: true,
          change: false,
          addressIndex: 1,
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );

      // then
      expect(getWalletAddressMock).not.toHaveBeenCalled();
    });

    it("Error if prepareWalletPolicy fails", (done) => {
      // given
      setupOpenAppDAMock();

      const deviceAction = new GetWalletAddressDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          walletBuilder: {} as WalletBuilder,
          walletSerializer: {} as WalletSerializer,
          dataStoreService: {} as DataStoreService,
          checkOnDevice: true,
          change: false,
          addressIndex: 1,
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );

      expect(getWalletAddressMock).not.toHaveBeenCalled();
    });

    it("Error if getWalletAddress fails", (done) => {
      // given
      setupOpenAppDAMock();

      const deviceAction = new GetWalletAddressDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          walletBuilder: {} as WalletBuilder,
          walletSerializer: {} as WalletSerializer,
          dataStoreService: {} as DataStoreService,
          checkOnDevice: true,
          change: false,
          addressIndex: 1,
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
        done,
      );
    });
  });
});
