import { concat, of, throwError } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { BTC_APP } from "@api/device-action/__test-utils__/data";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { setupListAppsMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { goToDashboardDAStateStep } from "@api/device-action/os/GoToDashboard/types";
import { listAppsDAStateStep } from "@api/device-action/os/ListApps/types";
import {
  type Catalog,
  type CustomImage,
  type DeviceSessionState,
  type FirmwareUpdateContext,
  type FirmwareVersion,
  type InstalledLanguagePackage,
} from "@api/device-session/DeviceSessionState";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { UnknownDeviceExchangeError } from "@api/Error";
import {
  type SecureChannelEventPayload,
  SecureChannelEventType,
} from "@api/secure-channel/task/types";
import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

import { GetDeviceMetadataDeviceAction } from "./GetDeviceMetadataDeviceAction";
import {
  type GetDeviceMetadataDAState,
  getDeviceMetadataDAStateStep,
} from "./types";

vi.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");
vi.mock("@api/device-action/os/ListApps/ListAppsDeviceAction");

describe("GetDeviceMetadataDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const getDeviceMetadataMock = vi.fn();
  const getFirmwareMetadataMock = vi.fn();
  const getApplicationsMetadataMock = vi.fn();
  const listAppsSecureChannelMock = vi.fn();

  const DEVICE_VERSION = "device_version" as unknown as DeviceVersion;
  const FIRMWARE = "firmware" as unknown as FinalFirmware;
  const FIRMWARE_VERSION = "firmware_version" as unknown as FirmwareVersion;
  const FIRMWARE_UPDATE = "fm_update" as unknown as FirmwareUpdateContext;
  const CUSTOM_IMAGE = "image" as unknown as CustomImage;
  const APPS = "apps" as unknown as Application[];
  const APPS_UPDATE = "apps_update" as unknown as Application[];
  const LANGUAGES = "lang" as unknown as InstalledLanguagePackage[];
  const CATALOG = "catalog" as unknown as Catalog;

  function extractDependenciesMock() {
    return {
      getDeviceMetadata: getDeviceMetadataMock,
      getFirmwareMetadata: getFirmwareMetadataMock,
      getApplicationsMetadata: getApplicationsMetadataMock,
      listAppsSecureChannel: listAppsSecureChannelMock,
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
    it("get metadata from device state", () =>
      new Promise<void>((resolve, reject) => {
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });

        getDeviceMetadataMock.mockResolvedValueOnce({
          firmwareVersion: FIRMWARE_VERSION,
          firmwareUpdateContext: FIRMWARE_UPDATE,
          customImage: CUSTOM_IMAGE,
          applications: APPS,
          applicationsUpdates: APPS_UPDATE,
          installedLanguages: LANGUAGES,
          catalog: CATALOG,
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
              applications: APPS,
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("fetch metadata without secure channel", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        setupListAppsMock([BTC_APP]);
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });

        getDeviceMetadataMock.mockResolvedValueOnce(null);
        getFirmwareMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              deviceVersion: DEVICE_VERSION,
              firmware: FIRMWARE,
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
            },
          }),
        );
        getApplicationsMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              applications: APPS,
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
            },
          }),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GoToDashboard wrapper
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GoToDashboard inner
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetFirmwareMetadata (high-level step: GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // ListApps wrapper (still under GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // ListApps inner
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
              step: listAppsDAStateStep.LIST_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetApplicationsMetadata wrapper (step: LIST_APPS)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.LIST_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
              applications: APPS,
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("fetch metadata with forced update", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        setupListAppsMock([BTC_APP]);
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: { forceUpdate: true },
        });

        getFirmwareMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              deviceVersion: DEVICE_VERSION,
              firmware: FIRMWARE,
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
            },
          }),
        );
        getApplicationsMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              applications: APPS,
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
            },
          }),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GoToDashboard - Initial step (forced update still starts at GET_DEVICE_METADATA)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GoToDashboard inner
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetFirmwareMetadata - After GoToDashboard, while fetching firmware, high-level step is GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // ListApps - While listing apps, high-level step still GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // ListApps inner (AllowListApps)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
              step: listAppsDAStateStep.LIST_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetApplicationsMetadata - Applications metadata wrapper (step: LIST_APPS)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.LIST_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
              applications: APPS,
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("fetch metadata with secure channel", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: { useSecureChannel: true },
        });

        getDeviceMetadataMock.mockResolvedValueOnce(null);
        getFirmwareMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              deviceVersion: DEVICE_VERSION,
              firmware: FIRMWARE,
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
            },
          }),
        );
        listAppsSecureChannelMock.mockReturnValue(
          of(
            {
              type: SecureChannelEventType.Exchange,
            },
            {
              type: SecureChannelEventType.PermissionRequested,
            },
            {
              type: SecureChannelEventType.PermissionGranted,
            },
            {
              type: SecureChannelEventType.Result,
              payload: [
                {
                  flags: 123456,
                  hash: "hash_test",
                  hash_code_data: "hash_code_data_test",
                  name: "Bitcoin",
                },
              ],
            },
          ),
        );
        getApplicationsMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              applications: APPS,
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
            },
          }),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper around GoToDashboard – machine still tags it as GET_DEVICE_METADATA
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // GoToDashboard inner
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetFirmwareMetadata – surfaced as GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // ListAppsSecureChannel wrapper – still GO_TO_DASHBOARD for the first emissions
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // More secure-channel emissions, still under GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // First applications-metadata-like transition (still GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Permission requested for secure channel – AllowSecureConnection, still GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction:
                UserInteractionRequired.AllowSecureConnection,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Back to “applications metadata” stream, still GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // One more pending under GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetApplicationsMetadata - Final pending before success: tagged as LIST_APPS_SECURE_CHANNEL
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.LIST_APPS_SECURE_CHANNEL,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
              applications: APPS,
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("get metadata from device state with external dependencies", () =>
      new Promise<void>((resolve, reject) => {
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });

        apiMock.getDeviceSessionState.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          firmwareVersion: {
            metadata: FIRMWARE_VERSION,
          } as unknown as FirmwareVersion,
          firmwareUpdateContext: FIRMWARE_UPDATE,
          customImage: CUSTOM_IMAGE,
          installedApps: [APPS] as unknown as Application[],
          appsUpdates: APPS_UPDATE,
          installedLanguages: LANGUAGES,
          catalog: CATALOG,
        } as DeviceSessionState);

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: {
              firmwareVersion: {
                metadata: FIRMWARE_VERSION,
              } as unknown as FirmwareVersion,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
              applications: [APPS] as unknown as Application[],
              applicationsUpdates: APPS_UPDATE,
              installedLanguages: LANGUAGES,
              catalog: CATALOG,
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

  describe("Error cases", () => {
    it("error during GoToDashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock(true);
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });

        getDeviceMetadataMock.mockResolvedValueOnce(null);
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper for GoToDashboard (still GET_DEVICE_METADATA)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Inner GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
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

    it("error during GetFirmwareMetadata", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });

        getDeviceMetadataMock.mockResolvedValueOnce(null);
        getFirmwareMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("GetFirmwareMetadata failed"),
          }),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper GoToDashboard (still GET_DEVICE_METADATA)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Inner GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetFirmwareMetadata (high-level GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDeviceExchangeError("GetFirmwareMetadata failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("error during ListApps", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        setupListAppsMock([], true);
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });

        getDeviceMetadataMock.mockResolvedValueOnce(null);
        getFirmwareMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              deviceVersion: DEVICE_VERSION,
              firmware: FIRMWARE,
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
            },
          }),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper GoToDashboard (still GET_DEVICE_METADATA)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Inner GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetFirmwareMetadata (GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper ListApps (still GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Inner ListApps (AllowListApps)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
              step: listAppsDAStateStep.LIST_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDAError("ListApps failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("error during GetApplicationsMetadata", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        setupListAppsMock([BTC_APP]);
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });

        getDeviceMetadataMock.mockResolvedValueOnce(null);
        getFirmwareMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              deviceVersion: DEVICE_VERSION,
              firmware: FIRMWARE,
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
            },
          }),
        );
        getApplicationsMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError(
              "GetApplicationsMetadata failed",
            ),
          }),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper GoToDashboard (still GET_DEVICE_METADATA)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Inner GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetFirmwareMetadata (GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper ListApps (still GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Inner ListApps
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
              step: listAppsDAStateStep.LIST_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper GetApplicationsMetadata (step: LIST_APPS)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.LIST_APPS,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDeviceExchangeError(
              "GetApplicationsMetadata failed",
            ),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("error during ListAppsSecureChannel", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: { useSecureChannel: true },
        });

        getDeviceMetadataMock.mockResolvedValueOnce(null);
        getFirmwareMetadataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              deviceVersion: DEVICE_VERSION,
              firmware: FIRMWARE,
              firmwareVersion: FIRMWARE_VERSION,
              firmwareUpdateContext: FIRMWARE_UPDATE,
              customImage: CUSTOM_IMAGE,
            },
          }),
        );
        listAppsSecureChannelMock.mockReturnValue(
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

        const expectedStates: Array<GetDeviceMetadataDAState> = [
          // GetDeviceMetadataFromContext
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Wrapper GoToDashboard (still GET_DEVICE_METADATA)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Inner GoToDashboard
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetFirmwareMetadata (GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // ListAppsSecureChannel wrapper (GO_TO_DASHBOARD)
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Last pending before error – back to GO_TO_DASHBOARD
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceMetadataDAStateStep.GO_TO_DASHBOARD,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
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
