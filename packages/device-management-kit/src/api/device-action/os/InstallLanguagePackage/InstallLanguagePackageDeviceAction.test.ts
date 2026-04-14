import { of, throwError } from "rxjs";

import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGetDeviceMetadataMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  MissingLanguagePackageDAError,
  MissingLanguagePackagesForOSDAError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import type { GetDeviceMetadataDAOutput } from "@api/device-action/os/GetDeviceMetadata/types";
import type { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import type { LanguagePackage } from "@internal/manager-api/model/Language";

import { InstallLanguagePackageDeviceAction } from "./InstallLanguagePackageDeviceAction";
import {
  type InstallLanguagePackageDAState,
  installLanguagePackageDAStateStep,
} from "./types";

vi.mock(
  "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction",
);

describe("InstallLanguagePackageDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const deleteCurrentLanguagePackMock = vi.fn();
  const installLanguagePackMock = vi.fn();

  const LANGUAGE_PACKAGE: LanguagePackage = {
    language: "french",
    languagePackageVersionId: 1,
    version: "1.0.0",
    languagePackageId: 42,
    apduInstallUrl: "https://example.com/install-french",
    apduUninstallUrl: "https://example.com/uninstall-french",
    bytes: 1024,
    dateCreation: "2024-01-01",
    dateLastModified: "2024-01-01",
  };

  const { None } = UserInteractionRequired;
  const {
    DEVICE_READY,
    GET_DEVICE_METADATA,
    DELETE_CURRENT_LANGUAGE_PACK,
    INSTALL_LANGUAGE_PACK,
  } = installLanguagePackageDAStateStep;

  function extractDependenciesMock() {
    return {
      deleteCurrentLanguagePack: deleteCurrentLanguagePackMock,
      installLanguagePack: installLanguagePackMock,
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
    it("should install a non-default language package", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          catalog: {
            languagePackages: [LANGUAGE_PACKAGE],
          },
        } as unknown as GetDeviceMetadataDAOutput);

        const deviceAction = new InstallLanguagePackageDeviceAction({
          input: {
            language: "french",
          },
        });

        deleteCurrentLanguagePackMock.mockResolvedValueOnce(undefined);
        installLanguagePackMock.mockReturnValueOnce(
          of(
            { type: "progress", progress: 0.5 },
            { type: "progress", progress: 1 },
          ),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallLanguagePackageDAState> = [
          // Initial
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DEVICE_READY,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // DeleteCurrentLanguagePack
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DELETE_CURRENT_LANGUAGE_PACK,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DELETE_CURRENT_LANGUAGE_PACK,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallLanguagePack
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: INSTALL_LANGUAGE_PACK,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: INSTALL_LANGUAGE_PACK,
              progress: 0.5,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: INSTALL_LANGUAGE_PACK,
              progress: 1,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: undefined,
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("should delete and skip install for the default language (english)", () =>
      new Promise<void>((resolve, reject) => {
        const deviceAction = new InstallLanguagePackageDeviceAction({
          input: {
            language: "english",
          },
        });

        deleteCurrentLanguagePackMock.mockResolvedValueOnce(undefined);
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallLanguagePackageDAState> = [
          // Initial
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DEVICE_READY,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // DeleteCurrentLanguagePack
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DELETE_CURRENT_LANGUAGE_PACK,
            },
            status: DeviceActionStatus.Pending,
          },
          // Success
          {
            output: undefined,
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
    it("should error when GetDeviceMetadata fails", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock(
          {} as unknown as GetDeviceMetadataDAOutput,
          true,
        );

        const deviceAction = new InstallLanguagePackageDeviceAction({
          input: {
            language: "french",
          },
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallLanguagePackageDAState> = [
          // Initial
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DEVICE_READY,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
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

    it("should error when language packages are missing from metadata", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          firmwareVersion: {
            mcu: "1.0.0",
            bootloader: "1.0.0",
            os: "2.4.0",
          },
          catalog: {
            languagePackages: undefined,
          },
        } as unknown as GetDeviceMetadataDAOutput);

        const deviceAction = new InstallLanguagePackageDeviceAction({
          input: {
            language: "french",
          },
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallLanguagePackageDAState> = [
          // Initial
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DEVICE_READY,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new MissingLanguagePackagesForOSDAError(
              "Language packages not found for OS 2.4.0.",
            ),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("should error when the requested language is not found", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          catalog: {
            languagePackages: [LANGUAGE_PACKAGE],
          },
        } as unknown as GetDeviceMetadataDAOutput);

        const deviceAction = new InstallLanguagePackageDeviceAction({
          input: {
            language: "spanish",
          },
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallLanguagePackageDAState> = [
          // Initial
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DEVICE_READY,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new MissingLanguagePackageDAError(
              "Language package not found for spanish.",
            ),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("should error when DeleteCurrentLanguagePack fails", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          catalog: {
            languagePackages: [LANGUAGE_PACKAGE],
          },
        } as unknown as GetDeviceMetadataDAOutput);

        const deviceAction = new InstallLanguagePackageDeviceAction({
          input: {
            language: "french",
          },
        });

        deleteCurrentLanguagePackMock.mockRejectedValueOnce(
          new UnknownDAError("Delete failed"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallLanguagePackageDAState> = [
          // Initial
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DEVICE_READY,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // DeleteCurrentLanguagePack
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DELETE_CURRENT_LANGUAGE_PACK,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDAError("Delete failed"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("should error when InstallLanguagePack observable errors", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceMetadataMock({
          catalog: {
            languagePackages: [LANGUAGE_PACKAGE],
          },
        } as unknown as GetDeviceMetadataDAOutput);

        const deviceAction = new InstallLanguagePackageDeviceAction({
          input: {
            language: "french",
          },
        });

        deleteCurrentLanguagePackMock.mockResolvedValueOnce(undefined);
        installLanguagePackMock.mockReturnValueOnce(
          throwError(() => new UnknownDAError("Install failed")),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<InstallLanguagePackageDAState> = [
          // Initial
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DEVICE_READY,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetDeviceMetadata
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            },
            status: DeviceActionStatus.Pending,
          },
          // DeleteCurrentLanguagePack
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DELETE_CURRENT_LANGUAGE_PACK,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: DELETE_CURRENT_LANGUAGE_PACK,
            },
            status: DeviceActionStatus.Pending,
          },
          // InstallLanguagePack
          {
            intermediateValue: {
              requiredUserInteraction: None,
              step: INSTALL_LANGUAGE_PACK,
              progress: 0,
            },
            status: DeviceActionStatus.Pending,
          },
          // Error
          {
            error: new UnknownDAError("Install failed"),
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
