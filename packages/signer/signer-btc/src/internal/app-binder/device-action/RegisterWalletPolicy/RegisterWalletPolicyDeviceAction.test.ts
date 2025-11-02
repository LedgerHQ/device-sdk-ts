/* eslint @typescript-eslint/consistent-type-imports: off */
import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { RegisterWalletPolicyDAState } from "@api/app-binder/RegisterWalletPolicyTypes";
import { WalletIdentity, WalletPolicy } from "@api/model/Wallet";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { RegisterWalletPolicyDeviceAction } from "./RegisterWalletPolicyDeviceAction";

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

describe("RegisterWalletPolicyDeviceAction", () => {
  const registerWalletPolicyMock = vi.fn();

  function extractDependenciesMock() {
    return {
      registerWalletPolicy: registerWalletPolicyMock,
    };
  }

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<void>((resolve, reject) => {
        // given
        setupOpenAppDAMock();

        const deviceAction = new RegisterWalletPolicyDeviceAction({
          input: {
            walletPolicy: "WalletPolicy" as unknown as WalletPolicy,
            dataStoreService: "DataStoreService" as unknown as DataStoreService,
            walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
            walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
            skipOpenApp: false,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        registerWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "WalletIdentity",
          }),
        );

        const expectedStates: Array<RegisterWalletPolicyDAState> = [
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
              requiredUserInteraction:
                UserInteractionRequired.RegisterWalletPolicy,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: "WalletIdentity" as unknown as WalletIdentity,
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

        const deviceAction = new RegisterWalletPolicyDeviceAction({
          input: {
            walletPolicy: "WalletPolicy" as unknown as WalletPolicy,
            dataStoreService: "DataStoreService" as unknown as DataStoreService,
            walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
            walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
            skipOpenApp: true,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        registerWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: "WalletIdentity",
          }),
        );

        const expectedStates: Array<RegisterWalletPolicyDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction:
                UserInteractionRequired.RegisterWalletPolicy,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: "WalletIdentity" as unknown as WalletIdentity,
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

        const expectedStates: Array<RegisterWalletPolicyDAState> = [
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

        const deviceAction = new RegisterWalletPolicyDeviceAction({
          input: {
            walletPolicy: "WalletPolicy" as unknown as WalletPolicy,
            dataStoreService: "DataStoreService" as unknown as DataStoreService,
            walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
            walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
            skipOpenApp: false,
          },
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
        expect(registerWalletPolicyMock).not.toHaveBeenCalled();
      }));

    it("Error if registerWalletPolicy fails", () =>
      new Promise<void>((resolve, reject) => {
        // given
        setupOpenAppDAMock();

        const deviceAction = new RegisterWalletPolicyDeviceAction({
          input: {
            walletPolicy: "WalletPolicy" as unknown as WalletPolicy,
            dataStoreService: "DataStoreService" as unknown as DataStoreService,
            walletBuilder: "WalletBuilder" as unknown as WalletBuilder,
            walletSerializer: "WalletSerializer" as unknown as WalletSerializer,
            skipOpenApp: false,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        registerWalletPolicyMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Mocked error"),
          }),
        );

        const expectedStates: Array<RegisterWalletPolicyDAState> = [
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
              requiredUserInteraction:
                UserInteractionRequired.RegisterWalletPolicy,
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

        expect(registerWalletPolicyMock).not.toHaveBeenCalled();
      }));
  });
});
