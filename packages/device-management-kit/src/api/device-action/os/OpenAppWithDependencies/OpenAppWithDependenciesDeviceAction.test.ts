// src/api/device-action/os/OpenAppWithDependencies/OpenAppWithDependenciesDeviceAction.test.ts
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import {
  setupGetDeviceMetadataMock,
  setupInstallOrUpdateAppsMock,
  setupOpenAppMock,
} from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  UnknownDAError,
  UnsupportedFirmwareDAError,
} from "@api/device-action/os/Errors";
import type { GetDeviceMetadataDAOutput } from "@api/device-action/os/GetDeviceMetadata/types";
import {
  type InstallOrUpdateAppsDAIntermediateValue,
  installOrUpdateAppsDAStateStep,
} from "@api/device-action/os/InstallOrUpdateApps/types";
import type { Application } from "@internal/manager-api/model/Application";

import { OpenAppWithDependenciesDeviceAction } from "./OpenAppWithDependenciesDeviceAction";
import type { OpenAppWithDependenciesDAState } from "./types";
import { openAppWithDependenciesDAStateSteps } from "./types";

vi.mock("@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction");
vi.mock(
  "@api/device-action/os/InstallOrUpdateApps/InstallOrUpdateAppsDeviceAction",
);
vi.mock(
  "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction",
);

describe("OpenAppWithDependenciesDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  const DEVICE_METADATA = {
    firmwareUpdateContext: {},
  } as unknown as GetDeviceMetadataDAOutput;

  const INSTALL_INTERMEDIATE_VALUE: InstallOrUpdateAppsDAIntermediateValue = {
    requiredUserInteraction: UserInteractionRequired.None,
    step: installOrUpdateAppsDAStateStep.INSTALL_APPLICATION,
    installPlan: {
      installPlan: [{ versionName: "1inch" }] as unknown as Application[],
      alreadyInstalled: ["Ethereum", "Uniswap"],
      missingApplications: [""],
      currentIndex: 0,
      currentProgress: 0.5,
    },
  };

  const INSTALL_RESULT = {
    successfullyInstalled: [
      { versionName: "1inch" },
    ] as unknown as Application[],
    alreadyInstalled: ["Ethereum", "Uniswap"],
    missingApplications: [""],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success cases", () => {
    it("Open app with dependencies", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock(DEVICE_METADATA);
        setupInstallOrUpdateAppsMock(
          INSTALL_RESULT,
          INSTALL_INTERMEDIATE_VALUE,
        );
        setupOpenAppMock();
        const deviceAction = new OpenAppWithDependenciesDeviceAction({
          input: {
            application: { name: "Ethereum" },
            dependencies: [{ name: "Uniswap" }, { name: "1inch" }],
            requireLatestFirmware: false,
          },
        });

        const expectedStates: Array<OpenAppWithDependenciesDAState> = [
          // GetDeviceMetadata (initial emission carries the step)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata snapshot (deviceId appears)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallOrUpdateApps entry
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.INSTALL_OR_UPDATE_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallOrUpdateApps snapshot (plan populated)
          {
            intermediateValue: {
              ...INSTALL_INTERMEDIATE_VALUE,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.INSTALL_OR_UPDATE_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp entry (keeps installPlan until snapshot)
          {
            intermediateValue: {
              ...INSTALL_INTERMEDIATE_VALUE,
              deviceId: undefined,
              requiredUserInteraction: UserInteractionRequired.None,
              step: openAppWithDependenciesDAStateSteps.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp snapshot (confirm on device, installPlan cleared)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              deviceMetadata: DEVICE_METADATA,
              installResult: INSTALL_RESULT,
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));
  });

  describe("error cases", () => {
    it("Get device metadata error", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock(DEVICE_METADATA, true);
        const deviceAction = new OpenAppWithDependenciesDeviceAction({
          input: {
            application: { name: "Ethereum" },
            dependencies: [{ name: "Uniswap" }, { name: "1inch" }],
            requireLatestFirmware: false,
          },
        });

        const expectedStates: Array<OpenAppWithDependenciesDAState> = [
          // GetDeviceMetadata initial
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata snapshot
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDAError("GetDeviceMetadata failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("Unsupported firmware", () =>
      new Promise<void>((resolve, reject) => {
        const metadataWithUpdate = {
          firmwareUpdateContext: {
            availableUpdate: "mockUpdate",
          },
        } as unknown as GetDeviceMetadataDAOutput;
        setupGetDeviceMetadataMock(metadataWithUpdate);
        const deviceAction = new OpenAppWithDependenciesDeviceAction({
          input: {
            application: { name: "Ethereum" },
            dependencies: [{ name: "Uniswap" }, { name: "1inch" }],
            requireLatestFirmware: true,
          },
        });

        const expectedStates: Array<OpenAppWithDependenciesDAState> = [
          // GetDeviceMetadata initial
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata snapshot
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnsupportedFirmwareDAError(
              "Firmware is not the latest version",
            ),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("Install apps error", () =>
      new Promise<void>((resolve, reject) => {
        const metadata = {
          firmwareUpdateContext: {},
        } as unknown as GetDeviceMetadataDAOutput;
        setupGetDeviceMetadataMock(metadata);
        setupInstallOrUpdateAppsMock(
          INSTALL_RESULT,
          INSTALL_INTERMEDIATE_VALUE,
          true,
        );
        const deviceAction = new OpenAppWithDependenciesDeviceAction({
          input: {
            application: { name: "Ethereum" },
            dependencies: [{ name: "Uniswap" }, { name: "1inch" }],
            requireLatestFirmware: false,
          },
        });

        const expectedStates: Array<OpenAppWithDependenciesDAState> = [
          // GetDeviceMetadata initial
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata snapshot
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallOrUpdateApps entry
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.INSTALL_OR_UPDATE_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallOrUpdateApps snapshot (plan populated)
          {
            intermediateValue: {
              ...INSTALL_INTERMEDIATE_VALUE,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.INSTALL_OR_UPDATE_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDAError("InstallOrUpdateApps failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("Open app error", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock(DEVICE_METADATA);
        setupInstallOrUpdateAppsMock(
          INSTALL_RESULT,
          INSTALL_INTERMEDIATE_VALUE,
        );
        setupOpenAppMock(true);
        const deviceAction = new OpenAppWithDependenciesDeviceAction({
          input: {
            application: { name: "Ethereum" },
            dependencies: [{ name: "Uniswap" }, { name: "1inch" }],
            requireLatestFirmware: false,
          },
        });

        const expectedStates: Array<OpenAppWithDependenciesDAState> = [
          // GetDeviceMetadata initial
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata snapshot
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallOrUpdateApps entry
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.INSTALL_OR_UPDATE_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallOrUpdateApps snapshot (plan populated)
          {
            intermediateValue: {
              ...INSTALL_INTERMEDIATE_VALUE,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.INSTALL_OR_UPDATE_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp entry (keeps installPlan until snapshot)
          {
            intermediateValue: {
              ...INSTALL_INTERMEDIATE_VALUE,
              deviceId: undefined,
              requiredUserInteraction: UserInteractionRequired.None,
              step: openAppWithDependenciesDAStateSteps.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp snapshot (confirm on device, installPlan cleared)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              installPlan: null,
              deviceId: undefined,
              step: openAppWithDependenciesDAStateSteps.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDAError("OpenApp failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));
  });
});
