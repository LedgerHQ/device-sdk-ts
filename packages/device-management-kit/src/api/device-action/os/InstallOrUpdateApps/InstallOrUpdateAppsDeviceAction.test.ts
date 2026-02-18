import { concat, of, throwError } from "rxjs";

import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { setupGetDeviceMetadataMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { OutOfMemoryDAError } from "@api/device-action/os/Errors";
import type { GetDeviceMetadataDAOutput } from "@api/device-action/os/GetDeviceMetadata/types";
import type { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import type { SecureChannelEventPayload } from "@api/secure-channel/task/types";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import type { Application } from "@internal/manager-api/model/Application";

import { InstallOrUpdateAppsDeviceAction } from "./InstallOrUpdateAppsDeviceAction";
import {
  type InstallOrUpdateAppsDAState,
  installOrUpdateAppsDAStateStep,
} from "./types";

vi.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");
vi.mock(
  "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction",
);

describe("InstallOrUpdateAppsDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const buildInstallPlanMock = vi.fn();
  const predictOutOfMemoryMock = vi.fn();
  const installAppMock = vi.fn();

  function extractDependenciesMock() {
    return {
      buildInstallPlan: buildInstallPlanMock,
      predictOutOfMemory: predictOutOfMemoryMock,
      installApp: installAppMock,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
    } as DeviceSessionState);
  });

  describe("success cases", () => {
    it("Install two applications", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            metadata: {
              targetId: 0x33200004,
            },
          },
        } as unknown as GetDeviceMetadataDAOutput);
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [
              { name: "Bitcoin" },
              { name: "Ethereum" },
              { name: "Solana" },
              { name: "XRP" },
              { name: "MyShitCoin" },
            ],
            allowMissingApplication: false,
          },
        });
        const installPlan = {
          installPlan: [
            { versionName: "Bitcoin" },
            { versionName: "XRP" },
          ] as Application[],
          alreadyInstalled: ["Ethereum", "Solana"],
          missingApplications: ["MyShitCoin"],
        };

        buildInstallPlanMock.mockResolvedValueOnce(installPlan);
        predictOutOfMemoryMock.mockResolvedValueOnce({
          outOfMemory: false,
        });
        installAppMock
          .mockReturnValueOnce(
            of(
              {
                type: SecureChannelEventType.PermissionRequested,
              },
              {
                type: SecureChannelEventType.PermissionGranted,
              },
              {
                type: SecureChannelEventType.Progress,
                payload: { progress: 0.5 },
              },
              {
                type: SecureChannelEventType.Progress,
                payload: { progress: 1 },
              },
            ),
          )
          .mockReturnValueOnce(
            of(
              {
                type: SecureChannelEventType.Progress,
                payload: { progress: 0.25 },
              },
              {
                type: SecureChannelEventType.Progress,
                payload: { progress: 0.75 },
              },
              {
                type: SecureChannelEventType.Progress,
                payload: { progress: 1 },
              },
            ),
          );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildInstallPlan
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // PredictOutOfMemory
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallApp
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallApp install first app
          {
            intermediateValue: {
              requiredUserInteraction:
                UserInteractionRequired.AllowSecureConnection,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0.5,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 1,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 1,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallApp install second app
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 1,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 1,
                currentProgress: 0.25,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 1,
                currentProgress: 0.75,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 1,
                currentProgress: 1,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 1,
                currentProgress: 1,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 1,
                currentProgress: 1,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              successfullyInstalled: [
                { versionName: "Bitcoin" },
                { versionName: "XRP" },
              ] as unknown as Application[],
              alreadyInstalled: ["Ethereum", "Solana"],
              missingApplications: ["MyShitCoin"],
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("No install is needed", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            metadata: {
              targetId: 0x33200004,
            },
          },
        } as unknown as GetDeviceMetadataDAOutput);
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [
              { name: "Bitcoin" },
              { name: "Ethereum" },
              { name: "Solana" },
              { name: "XRP" },
              { name: "MyShitCoin" },
            ],
            allowMissingApplication: false,
          },
        });
        const installPlan = {
          installPlan: [],
          alreadyInstalled: ["Ethereum", "Solana", "Bitcoin", "XRP"],
          missingApplications: ["MyShitCoin"],
        };

        buildInstallPlanMock.mockResolvedValueOnce(installPlan);
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildInstallPlan
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              successfullyInstalled: [],
              alreadyInstalled: ["Ethereum", "Solana", "Bitcoin", "XRP"],
              missingApplications: ["MyShitCoin"],
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
    it("Update device metadata failure", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock(
          {
            firmwareVersion: {
              metadata: {
                targetId: 0x33200004,
              },
            },
          } as unknown as GetDeviceMetadataDAOutput,
          true,
        );
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [{ name: "Bitcoin" }],
            allowMissingApplication: false,
          },
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
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

    it("Build install plan failure", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            metadata: {
              targetId: 0x33200004,
            },
          },
        } as unknown as GetDeviceMetadataDAOutput);
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [{ name: "Bitcoin" }],
            allowMissingApplication: false,
          },
        });

        buildInstallPlanMock.mockResolvedValueOnce({
          error: new UnknownDAError("BuildInstallPlan failed"),
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildInstallPlan
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            error: new UnknownDAError("BuildInstallPlan failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("Predict out of memory failure", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            metadata: {
              targetId: 0x33200004,
            },
          },
        } as unknown as GetDeviceMetadataDAOutput);
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [
              { name: "Bitcoin" },
              { name: "Ethereum" },
              { name: "Solana" },
              { name: "XRP" },
              { name: "MyShitCoin" },
            ],
            allowMissingApplication: false,
          },
        });
        const installPlan = {
          installPlan: [
            { versionName: "Bitcoin" },
            { versionName: "XRP" },
          ] as Application[],
          alreadyInstalled: ["Ethereum", "Solana"],
          missingApplications: ["MyShitCoin"],
        };

        buildInstallPlanMock.mockResolvedValueOnce(installPlan);
        predictOutOfMemoryMock.mockResolvedValueOnce({
          error: new UnknownDAError("PredictOutOfMemory failed"),
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildInstallPlan
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // PredictOutOfMemory
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            error: new UnknownDAError("PredictOutOfMemory failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("Is out of memory", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            metadata: {
              targetId: 0x33200004,
            },
          },
        } as unknown as GetDeviceMetadataDAOutput);
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [
              { name: "Bitcoin" },
              { name: "Ethereum" },
              { name: "Solana" },
              { name: "XRP" },
              { name: "MyShitCoin" },
            ],
            allowMissingApplication: false,
          },
        });
        const installPlan = {
          installPlan: [
            { versionName: "Bitcoin" },
            { versionName: "XRP" },
          ] as Application[],
          alreadyInstalled: ["Ethereum", "Solana"],
          missingApplications: ["MyShitCoin"],
        };

        buildInstallPlanMock.mockResolvedValueOnce(installPlan);
        predictOutOfMemoryMock.mockResolvedValueOnce({
          outOfMemory: true,
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildInstallPlan
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // PredictOutOfMemory
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            error: new OutOfMemoryDAError(
              "Not enough memory for those applications",
            ),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("Go to dashboard failure", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock(true);
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            metadata: {
              targetId: 0x33200004,
            },
          },
        } as unknown as GetDeviceMetadataDAOutput);
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [
              { name: "Bitcoin" },
              { name: "Ethereum" },
              { name: "Solana" },
              { name: "XRP" },
              { name: "MyShitCoin" },
            ],
            allowMissingApplication: false,
          },
        });
        const installPlan = {
          installPlan: [
            { versionName: "Bitcoin" },
            { versionName: "XRP" },
          ] as Application[],
          alreadyInstalled: ["Ethereum", "Solana"],
          missingApplications: ["MyShitCoin"],
        };

        buildInstallPlanMock.mockResolvedValueOnce(installPlan);
        predictOutOfMemoryMock.mockResolvedValueOnce({
          outOfMemory: false,
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildInstallPlan
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // PredictOutOfMemory
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            error: new UnknownDAError("GoToDashboard failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("Install app failure", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            metadata: {
              targetId: 0x33200004,
            },
          },
        } as unknown as GetDeviceMetadataDAOutput);
        const deviceAction = new InstallOrUpdateAppsDeviceAction({
          input: {
            applications: [
              { name: "Bitcoin" },
              { name: "Ethereum" },
              { name: "Solana" },
              { name: "XRP" },
              { name: "MyShitCoin" },
            ],
            allowMissingApplication: false,
          },
        });
        const installPlan = {
          installPlan: [
            { versionName: "Bitcoin" },
            { versionName: "XRP" },
          ] as Application[],
          alreadyInstalled: ["Ethereum", "Solana"],
          missingApplications: ["MyShitCoin"],
        };

        buildInstallPlanMock.mockResolvedValueOnce(installPlan);
        predictOutOfMemoryMock.mockResolvedValueOnce({
          outOfMemory: false,
        });
        installAppMock.mockReturnValue(
          concat(
            of({
              type: SecureChannelEventType.Exchange,
              payload: {
                data: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
              } as SecureChannelEventPayload["Exchange"],
            }),
            throwError(() => new UnknownDAError("Secure channel error")),
          ),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallOrUpdateAppsDAState> = [
          // UpdateDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildInstallPlan
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: null,
            },
            status: DeviceActionStatus.Pending,
          },
          // PredictOutOfMemory
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallApp
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: installOrUpdateAppsDAStateStep.UPDATE_DEVICE_METADATA,
              installPlan: {
                ...installPlan,
                currentIndex: 0,
                currentProgress: 0,
              },
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            error: new UnknownDAError("Secure channel error"),
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
