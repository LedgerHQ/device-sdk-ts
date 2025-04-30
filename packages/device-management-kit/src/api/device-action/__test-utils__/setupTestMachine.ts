import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { assign, createMachine } from "xstate";

import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { GetDeviceMetadataDeviceAction } from "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction";
import { type GetDeviceMetadataDAOutput } from "@api/device-action/os/GetDeviceMetadata/types";
import { GetDeviceStatusDeviceAction } from "@api/device-action/os/GetDeviceStatus/GetDeviceStatusDeviceAction";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import { InstallOrUpdateAppsDeviceAction } from "@api/device-action/os/InstallOrUpdateApps/InstallOrUpdateAppsDeviceAction";
import {
  type InstallOrUpdateAppsDAIntermediateValue,
  type InstallOrUpdateAppsDAOutput,
} from "@api/device-action/os/InstallOrUpdateApps/types";
import { ListAppsDeviceAction } from "@api/device-action/os/ListApps/ListAppsDeviceAction";
import { OpenAppDeviceAction } from "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction";
import { type DmkError } from "@api/Error";
import { ListInstalledAppsDeviceAction } from "@api/secure-channel/device-action/ListInstalledApps/ListInstalledAppsDeviceAction";
import { type InstalledApp } from "@api/secure-channel/device-action/ListInstalledApps/types";

import { type BTC_APP } from "./data";

type App = typeof BTC_APP;

export const setupListAppsMock = (apps: App[], error = false) => {
  (ListAppsDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
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

export const setupGetDeviceMetadataMock = (
  metadata: GetDeviceMetadataDAOutput,
  error = false,
) => {
  (GetDeviceMetadataDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        id: "MockGetDeviceMetadataDeviceAction",
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
            ? Left(new UnknownDAError("GetDeviceMetadata failed"))
            : Right(metadata);
        },
      }),
    ),
  }));
};

export const setupInstallOrUpdateAppsMock = (
  result: InstallOrUpdateAppsDAOutput,
  intermediateValue: InstallOrUpdateAppsDAIntermediateValue,
  error = false,
) => {
  (InstallOrUpdateAppsDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        id: "MockInstallOrUpdateAppsDeviceAction",
        initial: "ready",
        states: {
          ready: {
            after: {
              0: "done",
            },
            entry: assign({
              intermediateValue: () => intermediateValue,
            }),
          },
          done: {
            type: "final",
          },
        },
        output: () => {
          return error
            ? Left(new UnknownDAError("InstallOrUpdateApps failed"))
            : Right(result);
        },
      }),
    ),
  }));
};

export const setupOpenAppMock = (error: boolean = false) => {
  (OpenAppDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "ready",
        states: {
          ready: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              },
            }),
            after: {
              0: "done",
            },
          },
          done: {
            type: "final",
          },
        },
        output: () => {
          return error
            ? Left(new UnknownDAError("OpenApp failed"))
            : Right(undefined);
        },
      }),
    ),
  }));
};

export const setupGoToDashboardMock = (error: boolean = false) => {
  (GoToDashboardDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
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

export const setupGetDeviceStatusMock = (
  outputs: ReadonlyArray<
    { currentApp: string; currentAppVersion: string } | DmkError
  > = [
    {
      currentApp: "BOLOS",
      currentAppVersion: "1.0.0",
    },
  ],
) => {
  const outputFn = vi.fn();

  for (const output of outputs) {
    outputFn.mockImplementationOnce(() =>
      "currentApp" in output ? Right(output) : Left(output),
    );
  }
  (GetDeviceStatusDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        id: "MockGetDeviceStatusDeviceAction",
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
        output: outputFn,
      }),
    ),
  }));
};

export const setupListInstalledAppsMock = (
  outputs: Array<{ installedApps: InstalledApp[] } | DmkError> = [],
) => {
  (ListInstalledAppsDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        id: "MockListInstalledAppsDeviceAction",
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
        output: outputs
          .reduce(
            (mockFn, output) =>
              mockFn.mockImplementationOnce(() =>
                "installedApps" in output ? Right(output) : Left(output),
              ),
            vi.fn(),
          )
          .mockImplementation(() => Right([])),
      }),
    ),
  }));
};
