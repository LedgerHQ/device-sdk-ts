import { Left, Right } from "purify-ts";
import { concat, of, throwError } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import {
  type SecureChannelEventPayload,
  SecureChannelEventType,
} from "@api/secure-channel/task/types";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";
import { SecureChannelError } from "@internal/secure-channel/model/Errors";

import { ListInstalledAppsDeviceAction } from "./ListInstalledAppsDeviceAction";
import { type ListInstalledAppsDAState } from "./types";

vi.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");

describe("ListInstalledAppsDeviceAction", () => {
  const getOsVersionMock = vi.fn();
  const getDeviceVersionMock = vi.fn();
  const getFirmwareVersionMock = vi.fn();
  const listInstalledAppsMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const setDeviceSessionStateMock = vi.fn();

  const extractDependenciesMock = () => ({
    getOsVersion: getOsVersionMock,
    getDeviceVersion: getDeviceVersionMock,
    getFirmwareVersion: getFirmwareVersionMock,
    listInstalledApps: listInstalledAppsMock,
    getDeviceSessionState: getDeviceSessionStateMock,
    setDeviceSessionState: setDeviceSessionStateMock,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return a list that contains all installed apps on the device", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: "123456",
            secureElementFlags: {
              isSecureConnectionAllowed: true,
            },
          },
        }),
      );
      getDeviceVersionMock.mockResolvedValue(
        Right({ id: 123456 } as DeviceVersion),
      );
      getFirmwareVersionMock.mockResolvedValue(
        Right({ perso: "perso_test" } as FinalFirmware),
      );
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "BOLOS", version: "0.0.0" },
        isSecureConnectionAllowed: false,
      });
      listInstalledAppsMock.mockReturnValue(
        of(
          {
            type: SecureChannelEventType.Exchange,
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

      const expectedStates: Array<ListInstalledAppsDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: {
            installedApps: [
              {
                flags: 123456,
                hash: "hash_test",
                hash_code_data: "hash_code_data_test",
                name: "Bitcoin",
              },
            ],
          },
        },
      ];

      const listInstalledAppsDeviceAction = new ListInstalledAppsDeviceAction({
        input: {},
      });
      vi.spyOn(
        listInstalledAppsDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        listInstalledAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should return error when error occurs in fetching device version", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: "123456",
            secureElementFlags: {
              isSecureConnectionAllowed: false,
            },
          },
        }),
      );
      getDeviceVersionMock.mockResolvedValue(
        Left(new HttpFetchApiError("Device version fetch failed")),
      );
      getFirmwareVersionMock.mockResolvedValue(
        Right({ perso: "perso_test" } as FinalFirmware),
      );
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "BOLOS", version: "0.0.0" },
        isSecureConnectionAllowed: false,
      });
      listInstalledAppsMock.mockReturnValue(
        of(
          {
            type: SecureChannelEventType.Exchange,
            payload: {
              data: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
            } as SecureChannelEventPayload["Exchange"],
          },
          {
            type: SecureChannelEventType.Result,
            payload: [],
          },
        ),
      );

      const expectedStates: Array<ListInstalledAppsDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new HttpFetchApiError("Device version fetch failed"),
        },
      ];

      const listInstalledAppsDeviceAction = new ListInstalledAppsDeviceAction({
        input: {},
      });
      vi.spyOn(
        listInstalledAppsDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        listInstalledAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should return error when error occurs in fetching firmware version", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: "123456",
            secureElementFlags: {
              isSecureConnectionAllowed: false,
            },
          },
        }),
      );
      getDeviceVersionMock.mockResolvedValue(
        Right({ id: 123456 } as DeviceVersion),
      );
      getFirmwareVersionMock.mockResolvedValue(
        Left(new HttpFetchApiError("Firmware version fetch failed")),
      );
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "BOLOS", version: "0.0.0" },
        isSecureConnectionAllowed: false,
      });
      listInstalledAppsMock.mockReturnValue(
        of(
          {
            type: SecureChannelEventType.Exchange,
            payload: {
              data: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
            } as SecureChannelEventPayload["Exchange"],
          },
          {
            type: SecureChannelEventType.Result,
            payload: [],
          },
        ),
      );

      const expectedStates: Array<ListInstalledAppsDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new HttpFetchApiError("Firmware version fetch failed"),
        },
      ];

      const listInstalledAppsDeviceAction = new ListInstalledAppsDeviceAction({
        input: {},
      });
      vi.spyOn(
        listInstalledAppsDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        listInstalledAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should return error when error occurs in communicating with secure channel", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: "123456",
            secureElementFlags: {
              isSecureConnectionAllowed: false,
            },
          },
        }),
      );
      getDeviceVersionMock.mockResolvedValue(
        Right({ id: 123456 } as DeviceVersion),
      );
      getFirmwareVersionMock.mockResolvedValue(
        Right({ perso: "perso_test" } as FinalFirmware),
      );
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "BOLOS", version: "0.0.0" },
        isSecureConnectionAllowed: false,
      });
      listInstalledAppsMock.mockReturnValue(
        concat(
          of({
            type: SecureChannelEventType.Exchange,
            payload: {
              data: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
            } as SecureChannelEventPayload["Exchange"],
          }),
          throwError(() => new SecureChannelError("Secure channel error")),
        ),
      );

      const expectedStates: Array<ListInstalledAppsDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new SecureChannelError("Secure channel error"),
        },
      ];

      const listInstalledAppsDeviceAction = new ListInstalledAppsDeviceAction({
        input: {},
      });
      vi.spyOn(
        listInstalledAppsDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        listInstalledAppsDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
});
