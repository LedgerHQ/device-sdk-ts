import { Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { makeInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { ListAppsDeviceAction } from "@api/device-action/os/ListApps/ListAppsDeviceAction";
import { AppType } from "@internal/manager-api/model/ManagerApiResponses";

import { ListAppsWithMetadataDeviceAction } from "./ListAppsWithMetadataDeviceAction";
import { ListAppsWithMetadataDAState } from "./types";

jest.mock("@api/device-action/os/ListApps/ListAppsDeviceAction");

const BTC_APP = {
  appEntryLength: 77,
  appSizeInBlocks: 3227,
  appCodeHash:
    "924b5ba590971b3e98537cf8241f0aa51b1e6f26c37915dd38b83255168255d5",
  appFullHash:
    "81e73bd232ef9b26c00a152cb291388fb3ded1a2db6b44f53b3119d91d2879bb",
  appName: "Bitcoin",
};

const BTC_APP_METADATA = {
  versionId: 36248,
  versionName: "Bitcoin",
  versionDisplayName: "Bitcoin",
  version: "2.2.2",
  currencyId: "bitcoin",
  description: "",
  applicationType: AppType.currency,
  dateModified: "2024-04-08T11:31:34.847313Z",
  icon: "bitcoin",
  authorName: " Ledger",
  supportURL:
    "https://support.ledger.com/hc/en-us/articles/115005195945-Bitcoin-BTC-",
  contactURL: "mailto:https://support.ledger.com/hc/en-us/requests/new",
  sourceURL: "https://github.com/LedgerHQ/app-bitcoin-new",
  compatibleWallets:
    '[         {           "name": "Electrum",           "url": "https://electrum.org/#home"         }       ]',
  hash: "81e73bd232ef9b26c00a152cb291388fb3ded1a2db6b44f53b3119d91d2879bb",
  perso: "perso_11",
  firmware: "stax/1.4.0-rc2/bitcoin/app_2.2.2",
  firmwareKey: "stax/1.4.0-rc2/bitcoin/app_2.2.2_key",
  delete: "stax/1.4.0-rc2/bitcoin/app_2.2.2_del",
  deleteKey: "stax/1.4.0-rc2/bitcoin/app_2.2.2_del_key",
  bytes: 103264,
  warning: null,
  isDevTools: false,
  category: 1,
  parent: null,
  parentName: null,
};

// const CUSTOM_LOCK_SCREEN_APP = {
//   appEntryLength: 70,
//   appSizeInBlocks: 1093,
//   appCodeHash:
//     "0000000000000000000000000000000000000000000000000000000000000000",
//   appFullHash:
//     "5602b3d3fdde77fc02eb451a8beec4155bcf8b83ced794d7b3c63afaed5ff8c6",
//   appName: "",
// };

// const CUSTOM_LOCK_SCREEN_APP_METADATA = null;

// const ETH_APP = {
//   appEntryLength: 78,
//   appSizeInBlocks: 4120,
//   appCodeHash:
//     "4fdb751c0444f3a982c2ae9dcfde6ebe6dab03613d496f5e53cf91bce8ca46b5",
//   appFullHash:
//     "c7507c742ce3f8ec446b1ebda18159a5d432241a7199c3fc2401e72adfa9ab38",
//   appName: "Ethereum",
// };

// const ETH_APP_METADATA = {
//   versionId: 36185,
//   versionName: "Ethereum",
//   versionDisplayName: "Ethereum",
//   version: "1.10.4",
//   currencyId: "ethereum",
//   description: "",
//   applicationType: AppType.currency,
//   dateModified: "2024-04-09T12:28:55.783551Z",
//   icon: "ethereum",
//   authorName: " Ledger",
//   supportURL:
//     "https://support.ledger.com/hc/en-us/articles/360009576554-Ethereum-ETH-",
//   contactURL: "mailto:https://support.ledger.com/hc/en-us/requests/new",
//   sourceURL: "https://github.com/LedgerHQ/app-ethereum",
//   compatibleWallets:
//     '[  {           "name": "Metamask",           "url": "https://metamask.io/"         },    {           "name": "Phantom",           "url": "https://phantom.app/"         }, {           "name": "Rabby",           "url": "https://rabby.io/"         }, {           "name": "Rainbow",           "url": "https://rainbow.me/"         },   {           "name": "MyCrypto",           "url": "https://www.ledger.com/mycrypto/"         },         {           "name": "MyEtherWallet",           "url": "https://www.ledger.com/myetherwallet/"         }       ]',
//   hash: "c7507c742ce3f8ec446b1ebda18159a5d432241a7199c3fc2401e72adfa9ab38",
//   perso: "perso_11",
//   firmware: "stax/1.4.0-rc3/ethereum/app_1.10.4",
//   firmwareKey: "stax/1.4.0-rc3/ethereum/app_1.10.4_key",
//   delete: "stax/1.4.0-rc3/ethereum/app_1.10.4_del",
//   deleteKey: "stax/1.4.0-rc3/ethereum/app_1.10.4_del_key",
//   bytes: 131852,
//   warning: "",
//   isDevTools: false,
//   category: 1,
//   parent: null,
//   parentName: null,
// };

type App = typeof BTC_APP;

const setupListAppsMock = (apps: App[], error = false) => {
  (ListAppsDeviceAction as jest.Mock).mockImplementation(() => ({
    makeStateMachine: jest.fn().mockImplementation(() =>
      createMachine({
        id: "MockListAppsDeviceAction",
        initial: "ready",
        states: {
          ready: {
            after: {
              0: "done",
            },
            entry: assign({
              intermediateValue: () => ({
                requiredUserInteraction: UserInteractionRequired.AllowListApps,
              }),
            }),
          },
          done: {
            type: "final",
          },
        },
        output: () => {
          return error
            ? Left(new UnknownDAError("ListApps failed"))
            : Right(apps);
        },
      }),
    ),
  }));
};

describe("ListAppsWithMetadataDeviceAction", () => {
  const {
    managerApiService: managerApiServiceMock,
    // getDeviceSessionState: apiGetDeviceSessionStateMock,
    // setDeviceSessionState: apiSetDeviceSessionStateMock,
  } = makeInternalApiMock();

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

      jest.spyOn(managerApiServiceMock, "getAppsByHash").mockResolvedValue([]);

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
        makeInternalApiMock(),
        done,
      );
    });

    it("should run the device actions with 1 app installed", (done) => {
      setupListAppsMock([BTC_APP]);
      const listAppsWithMetadataDeviceAction =
        new ListAppsWithMetadataDeviceAction({
          input: {},
        });

      jest
        .spyOn(managerApiServiceMock, "getAppsByHash")
        .mockResolvedValue([BTC_APP_METADATA]);

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
          status: DeviceActionStatus.Pending, // ListAppsChecks
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending, // Success
        },
        {
          status: DeviceActionStatus.Completed,
          output: [BTC_APP_METADATA],
        },
      ];

      testDeviceActionStates(
        listAppsWithMetadataDeviceAction,
        expectedStates,
        makeInternalApiMock(),
        done,
      );
    });
  });

  // TODO: finish testing
});
