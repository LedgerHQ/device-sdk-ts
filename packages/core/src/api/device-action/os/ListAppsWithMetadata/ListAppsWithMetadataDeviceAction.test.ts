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

import { ListAppsWithMetadataDeviceAction } from "./ListAppsWithMetadataDeviceAction";
import { ListAppsWithMetadataDAState } from "./types";

jest.mock("@api/device-action/os/ListApps/ListAppsDeviceAction");

describe("ListAppsWithMetadataDeviceAction", () => {
  const {
    getMetadataForAppHashes: getMetadataForAppHashesMock,
    // getDeviceSessionState: apiGetDeviceSessionStateMock,
    // setDeviceSessionState: apiSetDeviceSessionStateMock,
  } = makeDeviceActionInternalApiMock();

  const saveSessionStateMock = jest.fn();
  const getDeviceSessionStateMock = jest.fn();
  const getAppsByHashMock = jest.fn();

  function extractDependenciesMock() {
    return {
      getAppsByHash: getAppsByHashMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      saveSessionState: saveSessionStateMock,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("success case", () => {
    it("should run the device actions with no apps installed", (done) => {
      setupListAppsMock([]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      getMetadataForAppHashesMock.mockResolvedValue(Right([]));

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
        done,
      );
    });

    it("should run the device actions with 1 app installed", (done) => {
      setupListAppsMock([BTC_APP]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      getMetadataForAppHashesMock.mockResolvedValue(Right([BTC_APP_METADATA]));

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
        done,
      );
    });

    it("should run the device actions with 2 apps installed", (done) => {
      setupListAppsMock([BTC_APP, ETH_APP]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      getMetadataForAppHashesMock.mockResolvedValue(
        Right([BTC_APP_METADATA, ETH_APP_METADATA]),
      );

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
        done,
      );
    });

    it("should run the device actions with 1 app installed and a custom lock screen", (done) => {
      setupListAppsMock([BTC_APP, CUSTOM_LOCK_SCREEN_APP]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      getMetadataForAppHashesMock.mockResolvedValue(
        Right([BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA]),
      );

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
        done,
      );
    });
  });

  describe("error case", () => {
    it("should error when ListApps fails", (done) => {
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
        done,
      );
    });

    it("should error when getAppsByHash rejects", (done) => {
      setupListAppsMock([BTC_APP]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      getMetadataForAppHashesMock.mockRejectedValue(
        new UnknownDAError("getAppsByHash failed"),
      );

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
        done,
      );
    });

    it("should error when getAppsByHash fails but error is known", (done) => {
      setupListAppsMock([BTC_APP]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      const error = new HttpFetchApiError(new Error("Failed to fetch data"));

      getMetadataForAppHashesMock.mockResolvedValue(Left(error));

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
        done,
      );
    });

    it("should error when SaveSession fails", (done) => {
      setupListAppsMock([BTC_APP]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      getAppsByHashMock.mockImplementation(async () =>
        Promise.resolve(Right([BTC_APP_METADATA])),
      );

      jest
        .spyOn(listAppsWithMetadataDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "BOLOS",
        installedApps: [],
      });

      saveSessionStateMock.mockImplementation(() => {
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
        done,
      );
    });
  });
});
