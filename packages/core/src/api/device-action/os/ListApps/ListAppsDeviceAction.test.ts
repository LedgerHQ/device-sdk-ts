import { Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  ListAppsRejectedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";

import { ListAppsDeviceAction } from "./ListAppsDeviceAction";
import { ListAppsDAState } from "./types";

const BTC_APP = {
  appEntryLength: 77,
  appSizeInBlocks: 3227,
  appCodeHash:
    "924b5ba590971b3e98537cf8241f0aa51b1e6f26c37915dd38b83255168255d5",
  appFullHash:
    "81e73bd232ef9b26c00a152cb291388fb3ded1a2db6b44f53b3119d91d2879bb",
  appName: "Bitcoin",
};
const CUSTOM_LOCK_SCREEN_APP = {
  appEntryLength: 70,
  appSizeInBlocks: 1093,
  appCodeHash:
    "0000000000000000000000000000000000000000000000000000000000000000",
  appFullHash:
    "5602b3d3fdde77fc02eb451a8beec4155bcf8b83ced794d7b3c63afaed5ff8c6",
  appName: "",
};

const ETH_APP = {
  appEntryLength: 78,
  appSizeInBlocks: 4120,
  appCodeHash:
    "4fdb751c0444f3a982c2ae9dcfde6ebe6dab03613d496f5e53cf91bce8ca46b5",
  appFullHash:
    "c7507c742ce3f8ec446b1ebda18159a5d432241a7199c3fc2401e72adfa9ab38",
  appName: "Ethereum",
};

const SOLANA_APP = {
  appEntryLength: 76,
  appSizeInBlocks: 2568,
  appCodeHash:
    "dcc77e385de4394f579fa7b6eeb7293950fe5aec6d5355a7049f77bc0d02de24",
  appFullHash:
    "afbdaa67241e21c00191b177198615b50c98e5db998c3bba1d78093a85dbedee",
  appName: "Solana",
};
const DOGECOIN_APP = {
  appEntryLength: 78,
  appSizeInBlocks: 2458,
  appCodeHash:
    "e59eee7bd32b1af2d93c5d8211e33d844d153a710d800254ea754e10ce18e7a9",
  appFullHash:
    "227001130f66297406696a19e1cf1e8e8b0cc14d5824ae8b1da98122c322e22e",
  appName: "Dogecoin",
};

jest.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");

const setupGoToDashboardMock = (error: boolean = false) => {
  (GoToDashboardDeviceAction as jest.Mock).mockImplementation(() => ({
    makeStateMachine: jest.fn().mockImplementation(() =>
      createMachine({
        id: "MockGoToDashboardDeviceAction",
        initial: "ready",
        states: {
          ready: {
            after: {
              0: "done",
            },
            entry: assign({
              intermediateValue: () => ({
                requiredUserInteraction: UserInteractionRequired.None,
              }),
            }),
          },
          done: {
            type: "final",
          },
        },
        output: () => {
          return error
            ? Left(new UnknownDAError("GoToDashboard failed"))
            : Right(undefined);
        },
      }),
    ),
  }));
};

describe("ListAppsDeviceAction", () => {
  const { sendCommand: sendCommandMock } = makeInternalApiMock();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("success cases", () => {
    it("should run the device action with no apps installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: {},
      });

      sendCommandMock.mockResolvedValue([]);

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
        makeInternalApiMock(),
        done,
      );
    });

    it("should run the device action with one app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock.mockResolvedValue([BTC_APP]);

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
        makeInternalApiMock(),
        done,
      );
    });

    it("should run the device action with two app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce([BTC_APP, CUSTOM_LOCK_SCREEN_APP])
        .mockResolvedValueOnce([]);

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
        makeInternalApiMock(),
        done,
      );
    });

    it("should run the device action with three app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce([BTC_APP, CUSTOM_LOCK_SCREEN_APP])
        .mockResolvedValueOnce([ETH_APP]);

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
        makeInternalApiMock(),
        done,
      );
    });

    it("should run the device action with four app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce([BTC_APP, CUSTOM_LOCK_SCREEN_APP])
        .mockResolvedValueOnce([ETH_APP, SOLANA_APP])
        .mockResolvedValueOnce([]);

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
        makeInternalApiMock(),
        done,
      );
    });

    it("should run the device action with five app installed", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce([BTC_APP, CUSTOM_LOCK_SCREEN_APP])
        .mockResolvedValueOnce([ETH_APP, SOLANA_APP])
        .mockResolvedValueOnce([DOGECOIN_APP]);

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
          ],
          status: DeviceActionStatus.Completed, // Success
        },
      ];

      testDeviceActionStates(
        listAppsDeviceAction,
        expectedStates,
        makeInternalApiMock(),
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

      sendCommandMock.mockResolvedValue([]);

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
        makeInternalApiMock(),
        done,
      );
    });

    it("should run the device action if GoTodashboard fails", (done) => {
      setupGoToDashboardMock(true);
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock.mockResolvedValue([]);

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
        makeInternalApiMock(),
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
        makeInternalApiMock(),
        done,
      );
    });

    it("should return an error if ListAppsContinue fails", (done) => {
      setupGoToDashboardMock();
      const listAppsDeviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout: 500 },
      });

      sendCommandMock
        .mockResolvedValueOnce([BTC_APP, CUSTOM_LOCK_SCREEN_APP])
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
        makeInternalApiMock(),
        done,
      );
    });
  });
});
