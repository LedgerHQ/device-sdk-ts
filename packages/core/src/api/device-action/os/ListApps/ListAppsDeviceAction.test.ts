import { CommandResultFactory } from "@api/command/model/CommandResult";
import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import {
  BTC_APP,
  CUSTOM_LOCK_SCREEN_APP,
  DOGECOIN_APP,
  ETH_APP,
  SOLANA_APP,
} from "@api/device-action/__test-utils__/data";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  ListAppsRejectedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";

import { ListAppsDeviceAction } from "./ListAppsDeviceAction";
import { ListAppsDAState } from "./types";

jest.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");

describe("ListAppsDeviceAction", () => {
  const { sendCommand: sendCommandMock } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("success cases", () => {
    it("should run the device action with no apps installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: {},
      });

      sendCommandMock.mockResolvedValue(CommandResultFactory({ data: [] }));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          output: [],
          status: DeviceActionStatus.Completed, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should run the device action with one app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock.mockResolvedValue(
        CommandResultFactory({ data: [BTC_APP] }),
      );

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          output: [BTC_APP],
          status: DeviceActionStatus.Completed, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should run the device action with two app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce(
          CommandResultFactory({ data: [BTC_APP, CUSTOM_LOCK_SCREEN_APP] }),
        )
        .mockResolvedValueOnce(CommandResultFactory({ data: [] }));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // ContinueListApps
        },
        {
          output: [BTC_APP, CUSTOM_LOCK_SCREEN_APP],
          status: DeviceActionStatus.Completed, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should run the device action with three app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce(
          CommandResultFactory({ data: [BTC_APP, CUSTOM_LOCK_SCREEN_APP] }),
        )
        .mockResolvedValueOnce(CommandResultFactory({ data: [ETH_APP] }));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // ContinueListApps
        },
        {
          output: [BTC_APP, CUSTOM_LOCK_SCREEN_APP, ETH_APP],
          status: DeviceActionStatus.Completed, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should run the device action with four app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce(
          CommandResultFactory({ data: [BTC_APP, CUSTOM_LOCK_SCREEN_APP] }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory({ data: [ETH_APP, SOLANA_APP] }),
        )
        .mockResolvedValueOnce(CommandResultFactory({ data: [] }));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // ContinueListApps
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // ContinueListApps
        },
        {
          output: [BTC_APP, CUSTOM_LOCK_SCREEN_APP, ETH_APP, SOLANA_APP],
          status: DeviceActionStatus.Completed, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should run the device action with five app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce(
          CommandResultFactory({ data: [BTC_APP, CUSTOM_LOCK_SCREEN_APP] }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory({ data: [ETH_APP, SOLANA_APP] }),
        )
        .mockResolvedValueOnce(CommandResultFactory({ data: [DOGECOIN_APP] }));
      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // ContinueListApps
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // ContinueListApps
        },
        {
          output: [
            BTC_APP,
            CUSTOM_LOCK_SCREEN_APP,
            ETH_APP,
            SOLANA_APP,
            DOGECOIN_APP,
          ] as ListAppsResponse,
          status: DeviceActionStatus.Completed, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
  });

  describe("error cases", () => {
    it("should return an error if GoTodashboard fails", (done) => {
      setupGoToDashboardMock(true);
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock.mockResolvedValue(CommandResultFactory({ data: [] }));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          error: new UnknownDAError("GoToDashboard failed"),
          status: DeviceActionStatus.Error, // Error
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should run the device action if GoTodashboard fails", (done) => {
      setupGoToDashboardMock(true);
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock.mockResolvedValue(CommandResultFactory({ data: [] }));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          error: new UnknownDAError("GoToDashboard failed"),
          status: DeviceActionStatus.Error, // Error
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should return an error if ListApps fails", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock.mockRejectedValue(new Error("mocked error"));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          error: new ListAppsRejectedError("User refused on device"),
          status: DeviceActionStatus.Error, // Error
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should return an error if ListAppsContinue fails", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce(
          CommandResultFactory({ data: [BTC_APP, CUSTOM_LOCK_SCREEN_APP] }),
        )
        .mockRejectedValueOnce(new UnknownDAError("mocked error"));

      const expectedStates: Array<ListAppsDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardDeviceAction
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // GoToDashboardCheck
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.AllowListApps,
          },
          status: DeviceActionStatus.Pending, // ListApps
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // ContinueListApps
        },
        {
          error: new UnknownDAError("mocked error"),
          status: DeviceActionStatus.Error, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
  });
});
