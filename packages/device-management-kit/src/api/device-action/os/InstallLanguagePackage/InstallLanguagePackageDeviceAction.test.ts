import { EitherAsync } from "purify-ts";

import { ErrorLanguageNotFound } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { getOsVersionCommandResponseMockBuilder } from "@api/command/os/__mocks__/GetOsVersionCommand";
import {
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@api/command/utils/GlobalCommandError";
import { DeviceModelId } from "@api/device/DeviceModel";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { goToDashboardDAStateStep } from "@api/device-action/os/GoToDashboard/types";
import { type LanguagePackage } from "@internal/manager-api/model/Language";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { InstallLanguagePackageDeviceAction } from "./InstallLanguagePackageDeviceAction";
import {
  type InstallLanguagePackageDAState,
  installLanguagePackageDAStateStep,
} from "./types";

vi.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");

describe("InstallLanguagePackageDeviceAction", () => {
  const {
    sendCommand: sendCommandMock,
    getManagerApiService: getManagerApiServiceMock,
  } = makeDeviceActionInternalApiMock();

  const DEVICE_VERSION = { id: 7 };
  const FIRMWARE_VERSION = { id: 361, version: "1.6.0", perso: "p" };

  const LANGUAGE_PACK: LanguagePackage = {
    language: "french",
    languagePackageVersionId: 1,
    version: "1.0.0",
    languagePackageId: 42,
    apduInstallUrl: "",
    apduUninstallUrl: "",
    bytes: 1,
    dateCreation: "",
    dateLastModified: "",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('with language "english" should delete all language packs and complete', () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      const osData = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_X,
      );
      sendCommandMock
        .mockResolvedValueOnce(CommandResultFactory({ data: osData }))
        .mockResolvedValueOnce(CommandResultFactory({ data: undefined }));

      const action = new InstallLanguagePackageDeviceAction({
        input: { unlockTimeout: 500, language: "english" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GO_TO_DASHBOARD,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GET_DEVICE_INFO,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.DELETE_ALL_LANGUAGE_PACKS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: undefined,
          status: DeviceActionStatus.Completed,
        },
      ];

      testDeviceActionStates(
        action,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it('with language other than "english" should resolve the catalog language pack', () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      const osData = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_X,
      );
      sendCommandMock.mockResolvedValue(CommandResultFactory({ data: osData }));

      getManagerApiServiceMock.mockReturnValue({
        getDeviceVersion: vi
          .fn()
          .mockReturnValue(EitherAsync(async () => DEVICE_VERSION)),
        getFirmwareVersion: vi
          .fn()
          .mockReturnValue(EitherAsync(async () => FIRMWARE_VERSION)),
        getLanguagePackages: vi
          .fn()
          .mockReturnValue(EitherAsync(async () => [LANGUAGE_PACK])),
      } as unknown as ManagerApiService);

      const action = new InstallLanguagePackageDeviceAction({
        input: { unlockTimeout: 500, language: "french" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GO_TO_DASHBOARD,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GET_DEVICE_INFO,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.RESOLVE_LANGUAGE_PACKAGE,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: LANGUAGE_PACK,
          status: DeviceActionStatus.Completed,
        },
      ];

      testDeviceActionStates(
        action,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should emit ErrorLanguageNotFound when the language is missing from the catalog", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      const osData = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_X,
      );
      sendCommandMock.mockResolvedValue(CommandResultFactory({ data: osData }));

      getManagerApiServiceMock.mockReturnValue({
        getDeviceVersion: vi
          .fn()
          .mockReturnValue(EitherAsync(async () => DEVICE_VERSION)),
        getFirmwareVersion: vi
          .fn()
          .mockReturnValue(EitherAsync(async () => FIRMWARE_VERSION)),
        getLanguagePackages: vi
          .fn()
          .mockReturnValue(
            EitherAsync(async () => [{ ...LANGUAGE_PACK, language: "german" }]),
          ),
      } as unknown as ManagerApiService);

      const action = new InstallLanguagePackageDeviceAction({
        input: { language: "russian" },
      });

      const notFound = new ErrorLanguageNotFound("russian");

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GO_TO_DASHBOARD,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GET_DEVICE_INFO,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.RESOLVE_LANGUAGE_PACKAGE,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: notFound,
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        action,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should fail when GetOsVersionCommand returns an error", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock();
      const globalError = new GlobalCommandError({
        errorCode: "5501",
        ...GLOBAL_ERRORS["5501"],
      });
      sendCommandMock.mockResolvedValue(
        CommandResultFactory({
          error: globalError,
        }),
      );

      const action = new InstallLanguagePackageDeviceAction({
        input: { language: "russian" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GO_TO_DASHBOARD,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GET_DEVICE_INFO,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: globalError,
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        action,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should fail when Go to dashboard fails", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardMock(true);
      sendCommandMock.mockResolvedValue(
        CommandResultFactory({
          data: getOsVersionCommandResponseMockBuilder(DeviceModelId.NANO_X),
        }),
      );

      const action = new InstallLanguagePackageDeviceAction({
        input: { unlockTimeout: 500, language: "russian" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GO_TO_DASHBOARD,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: goToDashboardDAStateStep.GET_DEVICE_STATUS,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new UnknownDAError("GoToDashboard failed"),
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        action,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
});
