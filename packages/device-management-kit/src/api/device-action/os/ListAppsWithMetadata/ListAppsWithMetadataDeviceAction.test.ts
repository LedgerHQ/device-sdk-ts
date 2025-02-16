import { Left, Right } from "purify-ts";

import { DeviceStatus } from "@api/device/DeviceStatus";
import {
  BTC_APP,
  BTC_APP_METADATA,
  CUSTOM_LOCK_SCREEN_APP,
  CUSTOM_LOCK_SCREEN_APP_METADATA,
  ETH_APP,
  ETH_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupListAppsMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { ListAppsWithMetadataDeviceAction } from "./ListAppsWithMetadataDeviceAction";
import { type ListAppsWithMetadataDAState } from "./types";

vi.mock("@api/device-action/os/ListApps/ListAppsDeviceAction");

describe("ListAppsWithMetadataDeviceAction", () => {
  const { getManagerApiService: getManagerApiServiceMock } =
    makeDeviceActionInternalApiMock();

  const setDeviceSessionStateMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const getAppsByHashMock = vi.fn();

  function extractDependenciesMock() {
    return {
      getAppsByHash: getAppsByHashMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      setDeviceSessionState: setDeviceSessionStateMock,
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("success case", () => {
    it("should run the device actions with no apps installed", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([]);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        getManagerApiServiceMock.mockReturnValue({
          getAppsByHash: vi.fn().mockResolvedValue(Right([])),
        } as unknown as ManagerApiService);

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            status: DeviceActionStatus.Completed,
            output: [],
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should run the device actions with 1 app installed", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([BTC_APP]);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        getManagerApiServiceMock.mockReturnValue({
          getAppsByHash: vi.fn().mockResolvedValue(Right([BTC_APP_METADATA])),
        } as unknown as ManagerApiService);

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // FetchMetadata
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // SaveSession
          },
          {
            status: DeviceActionStatus.Completed,
            output: [BTC_APP_METADATA],
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should run the device actions with 2 apps installed", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([BTC_APP, ETH_APP]);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        getManagerApiServiceMock.mockReturnValue({
          getAppsByHash: vi
            .fn()
            .mockResolvedValue(Right([BTC_APP_METADATA, ETH_APP_METADATA])),
        } as unknown as ManagerApiService);

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // FetchMetadata
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // SaveSession
          },
          {
            status: DeviceActionStatus.Completed,
            output: [BTC_APP_METADATA, ETH_APP_METADATA],
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should run the device actions with 1 app installed and a custom lock screen", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([BTC_APP, CUSTOM_LOCK_SCREEN_APP]);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        getManagerApiServiceMock.mockReturnValue({
          getAppsByHash: vi
            .fn()
            .mockResolvedValue(
              Right([BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA]),
            ),
        } as unknown as ManagerApiService);

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // FetchMetadata
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // SaveSession
          },
          {
            status: DeviceActionStatus.Completed,
            output: [BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA],
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });

  describe("error case", () => {
    it("should error when ListApps fails", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([], true);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("ListApps failed"),
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should error when getAppsByHash rejects", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([BTC_APP]);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        getManagerApiServiceMock.mockReturnValue({
          getAppsByHash: vi
            .fn()
            .mockRejectedValue(new UnknownDAError("getAppsByHash failed")),
        } as unknown as ManagerApiService);

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // FetchMetadata
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("getAppsByHash failed"),
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should error when getAppsByHash fails but error is known", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([BTC_APP]);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        const error = new HttpFetchApiError(new Error("Failed to fetch data"));

        getManagerApiServiceMock.mockReturnValue({
          getAppsByHash: vi.fn().mockResolvedValue(Left(error)),
        } as unknown as ManagerApiService);

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // FetchMetadata
          },
          {
            status: DeviceActionStatus.Error,
            error,
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should error when SaveSession fails", () =>
      new Promise<void>((resolve, reject) => {
        setupListAppsMock([BTC_APP]);
        const listAppsWithMetadataDeviceAction =
          new ListAppsWithMetadataDeviceAction({
            input: {},
          });

        getAppsByHashMock.mockImplementation(async () =>
          Promise.resolve(Right([BTC_APP_METADATA])),
        );

        vi.spyOn(
          listAppsWithMetadataDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: "BOLOS",
          installedApps: [],
        });

        setDeviceSessionStateMock.mockImplementation(() => {
          throw new UnknownDAError("SaveSession failed");
        });

        const expectedStates: Array<ListAppsWithMetadataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // Ready
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            },
            status: DeviceActionStatus.Pending, // ListAppsDeviceAction
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // FetchMetadata
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // SaveSession
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("SaveSession failed"),
          },
        ];

        testDeviceActionStates(
          listAppsWithMetadataDeviceAction,
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
