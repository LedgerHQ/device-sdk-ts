import { of, throwError } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import { DeleteLanguagePackCommandError } from "@api/command/os/DeleteLanguagePackCommand";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGetDeviceMetadataMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeleteLanguagePackDAError,
  MissingLanguagePackageDAError,
  MissingLanguagePackagesForOSDAError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import type { GetDeviceMetadataDAOutput } from "@api/device-action/os/GetDeviceMetadata/types";
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

  const extractDependenciesMock = {
    deleteCurrentLanguagePack: deleteCurrentLanguagePackMock,
    installLanguagePack: installLanguagePackMock,
  };

  const buildMetadata = (
    partial: {
      installedLanguages?: Array<{ id: number; size: number }>;
      catalog?: { languagePackages?: LanguagePackage[] | undefined };
      firmwareVersion?: GetDeviceMetadataDAOutput["firmwareVersion"];
    } = {},
  ): GetDeviceMetadataDAOutput =>
    ({
      installedLanguages: [],
      ...partial,
      catalog: {
        languagePackages: [],
        ...(partial.catalog ?? {}),
      },
    }) as unknown as GetDeviceMetadataDAOutput;

  const runTest = (
    deviceAction: InstallLanguagePackageDeviceAction,
    expectedStates: Array<InstallLanguagePackageDAState>,
    onDoneExtra?: () => void,
  ) =>
    new Promise<void>((resolve, reject) => {
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock,
      );
      testDeviceActionStates(deviceAction, expectedStates, apiMock, {
        onDone: () => {
          try {
            onDoneExtra?.();
            resolve();
          } catch (e) {
            reject(e as Error);
          }
        },
        onError: reject,
      });
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success cases", () => {
    it("should install a non-default language package", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({ catalog: { languagePackages: [LANGUAGE_PACKAGE] } }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      deleteCurrentLanguagePackMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );
      installLanguagePackMock.mockReturnValueOnce(
        of(
          { type: "progress", progress: 0.5 },
          { type: "progress", progress: 1 },
        ),
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

      return runTest(deviceAction, expectedStates);
    });

    it("should install when a different language pack is already installed", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({
          catalog: { languagePackages: [LANGUAGE_PACKAGE] },
          installedLanguages: [{ id: 999, size: 2048 }],
        }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      deleteCurrentLanguagePackMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );
      installLanguagePackMock.mockReturnValueOnce(
        of({ type: "progress", progress: 1 }),
      );

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
            progress: 1,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: undefined,
          status: DeviceActionStatus.Completed,
        },
      ];

      return runTest(deviceAction, expectedStates, () => {
        expect(deleteCurrentLanguagePackMock).toHaveBeenCalledOnce();
        expect(installLanguagePackMock).toHaveBeenCalledOnce();
      });
    });

    it("should succeed without delete or install when the language pack is already installed", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({
          catalog: { languagePackages: [LANGUAGE_PACKAGE] },
          installedLanguages: [
            {
              id: LANGUAGE_PACKAGE.languagePackageId,
              size: LANGUAGE_PACKAGE.bytes,
            },
          ],
        }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
        {
          output: undefined,
          status: DeviceActionStatus.Completed,
        },
      ];

      return runTest(deviceAction, expectedStates, () => {
        expect(deleteCurrentLanguagePackMock).not.toHaveBeenCalled();
        expect(installLanguagePackMock).not.toHaveBeenCalled();
      });
    });

    it("should install when only a matching languagePackageVersionId is reported as installed", () => {
      // Guards against a regression where the implementation compares against
      // languagePackageVersionId instead of languagePackageId.
      setupGetDeviceMetadataMock(
        buildMetadata({
          catalog: { languagePackages: [LANGUAGE_PACKAGE] },
          installedLanguages: [
            {
              id: LANGUAGE_PACKAGE.languagePackageVersionId,
              size: LANGUAGE_PACKAGE.bytes,
            },
          ],
        }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      deleteCurrentLanguagePackMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );
      installLanguagePackMock.mockReturnValueOnce(
        of({ type: "progress", progress: 1 }),
      );

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
            progress: 1,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: undefined,
          status: DeviceActionStatus.Completed,
        },
      ];

      return runTest(deviceAction, expectedStates, () => {
        expect(installLanguagePackMock).toHaveBeenCalledOnce();
      });
    });

    it("should delete and skip install for the default language (english)", () => {
      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "english" },
      });

      deleteCurrentLanguagePackMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
        {
          output: undefined,
          status: DeviceActionStatus.Completed,
        },
      ];

      return runTest(deviceAction, expectedStates, () => {
        expect(deleteCurrentLanguagePackMock).toHaveBeenCalledOnce();
        expect(installLanguagePackMock).not.toHaveBeenCalled();
      });
    });
  });

  describe("error cases", () => {
    it("should error when GetDeviceMetadata fails", () => {
      setupGetDeviceMetadataMock(
        {} as unknown as GetDeviceMetadataDAOutput,
        true,
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
        {
          error: new UnknownDAError("GetDeviceMetadata failed"),
          status: DeviceActionStatus.Error,
        },
      ];

      return runTest(deviceAction, expectedStates);
    });

    it("should error when language packages are missing from metadata", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({
          firmwareVersion: {
            mcu: "1.0.0",
            bootloader: "1.0.0",
            os: "2.4.0",
          } as GetDeviceMetadataDAOutput["firmwareVersion"],
          catalog: { languagePackages: undefined },
        }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
        {
          error: new MissingLanguagePackagesForOSDAError(
            "Language packages not found for OS 2.4.0.",
          ),
          status: DeviceActionStatus.Error,
        },
      ];

      return runTest(deviceAction, expectedStates);
    });

    it("should error when the requested language is not found", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({ catalog: { languagePackages: [LANGUAGE_PACKAGE] } }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "spanish" },
      });

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
        {
          error: new MissingLanguagePackageDAError(
            "Language package not found for spanish.",
          ),
          status: DeviceActionStatus.Error,
        },
      ];

      return runTest(deviceAction, expectedStates);
    });

    it("should error when DeleteCurrentLanguagePack returns a command error", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({ catalog: { languagePackages: [LANGUAGE_PACKAGE] } }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      deleteCurrentLanguagePackMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new DeleteLanguagePackCommandError({
            message: "Invalid LANG_ID value.",
            errorCode: "681a",
          }),
        }),
      );

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
            step: DELETE_CURRENT_LANGUAGE_PACK,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new DeleteLanguagePackDAError("Invalid LANG_ID value."),
          status: DeviceActionStatus.Error,
        },
      ];

      return runTest(deviceAction, expectedStates);
    });

    it("should error when DeleteCurrentLanguagePack promise rejects", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({ catalog: { languagePackages: [LANGUAGE_PACKAGE] } }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      deleteCurrentLanguagePackMock.mockRejectedValueOnce(
        new DeleteLanguagePackDAError("Delete failed"),
      );

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
            step: DELETE_CURRENT_LANGUAGE_PACK,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new DeleteLanguagePackDAError("Delete failed"),
          status: DeviceActionStatus.Error,
        },
      ];

      return runTest(deviceAction, expectedStates);
    });

    it("should error when InstallLanguagePack observable errors", () => {
      setupGetDeviceMetadataMock(
        buildMetadata({ catalog: { languagePackages: [LANGUAGE_PACKAGE] } }),
      );

      const deviceAction = new InstallLanguagePackageDeviceAction({
        input: { language: "french" },
      });

      deleteCurrentLanguagePackMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );
      installLanguagePackMock.mockReturnValueOnce(
        throwError(() => new UnknownDAError("Install failed")),
      );

      const expectedStates: Array<InstallLanguagePackageDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
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
        {
          intermediateValue: {
            requiredUserInteraction: None,
            step: INSTALL_LANGUAGE_PACK,
            progress: 0,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new UnknownDAError("Install failed"),
          status: DeviceActionStatus.Error,
        },
      ];

      return runTest(deviceAction, expectedStates);
    });
  });
});
