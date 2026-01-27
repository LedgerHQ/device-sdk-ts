import React from "react";
import { useMemo } from "react";
import {
  type GenuineCheckDAError,
  type GenuineCheckDAInput,
  type GenuineCheckDAIntermediateValue,
  type GenuineCheckDAOutput,
  GenuineCheckDeviceAction,
  type GetDeviceMetadataDAError,
  type GetDeviceMetadataDAInput,
  type GetDeviceMetadataDAIntermediateValue,
  type GetDeviceMetadataDAOutput,
  GetDeviceMetadataDeviceAction,
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDAIntermediateValue,
  type GetDeviceStatusDAOutput,
  GetDeviceStatusDeviceAction,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
  type GoToDashboardDAOutput,
  GoToDashboardDeviceAction,
  hexaStringToBuffer,
  type InstallAppDAError,
  type InstallAppDAInput,
  type InstallAppDAIntermediateValue,
  type InstallAppDAOutput,
  InstallAppDeviceAction,
  type InstallOrUpdateAppsDAError,
  type InstallOrUpdateAppsDAIntermediateValue,
  type InstallOrUpdateAppsDAOutput,
  InstallOrUpdateAppsDeviceAction,
  type ListAppsDAError,
  type ListAppsDAInput,
  type ListAppsDAIntermediateValue,
  type ListAppsDAOutput,
  ListAppsDeviceAction,
  type ListAppsWithMetadataDAError,
  type ListAppsWithMetadataDAInput,
  type ListAppsWithMetadataDAIntermediateValue,
  type ListAppsWithMetadataDAOutput,
  ListAppsWithMetadataDeviceAction,
  type ListInstalledAppsDAError,
  type ListInstalledAppsDAInput,
  type ListInstalledAppsDAIntermediateValue,
  type ListInstalledAppsDAOutput,
  ListInstalledAppsDeviceAction,
  type OpenAppDAError,
  type OpenAppDAInput,
  type OpenAppDAIntermediateValue,
  type OpenAppDAOutput,
  OpenAppDeviceAction,
  type OpenAppWithDependenciesDAError,
  type OpenAppWithDependenciesDAIntermediateValue,
  type OpenAppWithDependenciesDAOutput,
  OpenAppWithDependenciesDeviceAction,
  type UninstallAppDAError,
  type UninstallAppDAInput,
  type UninstallAppDAIntermediateValue,
  type UninstallAppDAOutput,
  UninstallAppDeviceAction,
} from "@ledgerhq/device-management-kit";
import {
  type DownloadCustomLockScreenDAError,
  type DownloadCustomLockScreenDAIntermediateValue,
  type DownloadCustomLockScreenDAOutput,
  DownloadCustomLockScreenDeviceAction,
  type GetCustomLockScreenInfoDAError,
  type GetCustomLockScreenInfoDAInput,
  type GetCustomLockScreenInfoDAIntermediateValue,
  type GetCustomLockScreenInfoDAOutput,
  GetCustomLockScreenInfoDeviceAction,
  isCustomLockScreenSupported,
  type RemoveCustomLockScreenDAError,
  type RemoveCustomLockScreenDAInput,
  type RemoveCustomLockScreenDAIntermediateValue,
  type RemoveCustomLockScreenDAOutput,
  RemoveCustomLockScreenDeviceAction,
  type UploadCustomLockScreenDAError,
  type UploadCustomLockScreenDAIntermediateValue,
  type UploadCustomLockScreenDAOutput,
  UploadCustomLockScreenDeviceAction,
} from "@ledgerhq/dmk-ledger-wallet";

import { DownloadOutput } from "@/components/CustomLockScreenDownloadOutput/DownloadOutput";
import { PictureInput } from "@/components/CustomLockScreenPictureInput/PictureInput";
import { type PictureInputValues } from "@/components/CustomLockScreenPictureInput/types";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

import { DeviceActionsList, UNLOCK_TIMEOUT } from "./DeviceActionsList";
import { type DeviceActionProps } from "./DeviceActionTester";

const SECURE_CHANNEL_ICON = "🔒 ";
const CLS_ICON = "🖼️";

export const AllDeviceActions: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  const clsSupported = useMemo(
    () => isCustomLockScreenSupported(deviceModelId),
    [deviceModelId],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Open app",
        description:
          "Perform all the actions necessary to open an app on the device",
        executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
          const deviceAction = new OpenAppDeviceAction({
            input: {
              appName,
              unlockTimeout,
            },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: {
          appName: "",
          unlockTimeout: UNLOCK_TIMEOUT,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        OpenAppDAOutput,
        OpenAppDAInput,
        OpenAppDAError,
        OpenAppDAIntermediateValue
      >,
      {
        title: `${SECURE_CHANNEL_ICON} Open app with dependencies`,
        description:
          "Perform all the actions necessary to open an app on the device and install its dependencies",
        executeDeviceAction: (
          { appName, dependencies, requireLatestFirmware, unlockTimeout },
          inspect,
        ) => {
          const application = { name: appName };
          const dependenciesArray = dependencies
            .split(",")
            .map((app) => ({ name: app.trim() }));
          const deviceAction = new OpenAppWithDependenciesDeviceAction({
            input: {
              application,
              dependencies: dependenciesArray,
              requireLatestFirmware,
              unlockTimeout,
            },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: {
          appName: "Ethereum",
          dependencies: "Uniswap,1inch",
          requireLatestFirmware: false,
          unlockTimeout: UNLOCK_TIMEOUT,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        OpenAppWithDependenciesDAOutput,
        {
          appName: string;
          dependencies: string;
          requireLatestFirmware: boolean;
          unlockTimeout: number;
        },
        OpenAppWithDependenciesDAError,
        OpenAppWithDependenciesDAIntermediateValue
      >,
      {
        title: "Get device status",
        description:
          "Perform various checks on the device to determine its status",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new GetDeviceStatusDeviceAction({
            input: { unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetDeviceStatusDAOutput,
        GetDeviceStatusDAInput,
        GetDeviceStatusDAError,
        GetDeviceStatusDAIntermediateValue
      >,
      {
        title: "Go to dashboard",
        description: "Navigate to the dashboard",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new GoToDashboardDeviceAction({
            input: { unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        GoToDashboardDAOutput,
        GoToDashboardDAInput,
        GoToDashboardDAError,
        GoToDashboardDAIntermediateValue
      >,
      {
        title: "List apps",
        description: "List all applications installed on the device",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new ListAppsDeviceAction({
            input: { unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        ListAppsDAOutput,
        ListAppsDAInput,
        ListAppsDAError,
        ListAppsDAIntermediateValue
      >,
      {
        title: "List apps with metadata",
        description:
          "List all applications installed on the device with additional metadata",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new ListAppsWithMetadataDeviceAction({
            input: { unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        ListAppsWithMetadataDAOutput,
        ListAppsWithMetadataDAInput,
        ListAppsWithMetadataDAError,
        ListAppsWithMetadataDAIntermediateValue
      >,
      {
        title: "Get device metadata",
        description: "Fetch lazily all the device metadata",
        executeDeviceAction: (
          { useSecureChannel, forceUpdate, unlockTimeout },
          inspect,
        ) => {
          const deviceAction = new GetDeviceMetadataDeviceAction({
            input: { useSecureChannel, forceUpdate, unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: {
          useSecureChannel: false,
          forceUpdate: false,
          unlockTimeout: UNLOCK_TIMEOUT,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetDeviceMetadataDAOutput,
        GetDeviceMetadataDAInput,
        GetDeviceMetadataDAError,
        GetDeviceMetadataDAIntermediateValue
      >,
      {
        title: `${SECURE_CHANNEL_ICON} Genuine Check`,
        description:
          "Perform all the actions necessary to check the device's genuineness",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new GenuineCheckDeviceAction({
            input: { unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        GenuineCheckDAOutput,
        GenuineCheckDAInput,
        GenuineCheckDAError,
        GenuineCheckDAIntermediateValue
      >,
      {
        title: `${SECURE_CHANNEL_ICON} List Installed App`,
        description:
          "Perform all the actions necessary to list installed apps on the device",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new ListInstalledAppsDeviceAction({
            input: { unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        ListInstalledAppsDAOutput,
        ListInstalledAppsDAInput,
        ListInstalledAppsDAError,
        ListInstalledAppsDAIntermediateValue
      >,
      {
        title: `${SECURE_CHANNEL_ICON} Install or update applications`,
        description:
          "Perform all the actions necessary to install or update a list of apps on the device by name",
        executeDeviceAction: (
          { applications, allowMissingApplication, unlockTimeout },
          inspect,
        ) => {
          const apps = applications.split(",").map((app) => ({ name: app }));
          const deviceAction = new InstallOrUpdateAppsDeviceAction({
            input: {
              applications: apps,
              allowMissingApplication,
              unlockTimeout,
            },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: {
          applications: "Bitcoin,Ethereum,Solana",
          allowMissingApplication: false,
          unlockTimeout: UNLOCK_TIMEOUT,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        InstallOrUpdateAppsDAOutput,
        {
          applications: string;
          allowMissingApplication: boolean;
          unlockTimeout: number;
        },
        InstallOrUpdateAppsDAError,
        InstallOrUpdateAppsDAIntermediateValue
      >,
      {
        title: `${SECURE_CHANNEL_ICON} Install App`,
        description:
          "Perform all the actions necessary to install an app on the device by name",
        executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
          const deviceAction = new InstallAppDeviceAction({
            input: { appName, unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { appName: "", unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        InstallAppDAOutput,
        InstallAppDAInput,
        InstallAppDAError,
        InstallAppDAIntermediateValue
      >,
      {
        title: `${SECURE_CHANNEL_ICON} Uninstall App`,
        description:
          "Perform all the actions necessary to uninstall an app on the device by name",
        executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
          const deviceAction = new UninstallAppDeviceAction({
            input: { appName, unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { appName: "", unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        UninstallAppDAOutput,
        UninstallAppDAInput,
        UninstallAppDAError,
        UninstallAppDAIntermediateValue
      >,
      // Custom Lock Screen actions (only for supported devices)
      ...(clsSupported
        ? [
            {
              title: `${CLS_ICON} Upload Custom Lock Screen (Hex)`,
              description:
                "Upload a custom lock screen image using raw hex data. The hex data should be the processed image data in the device format.",
              executeDeviceAction: (
                { imageDataHex, unlockTimeout },
                inspect,
              ) => {
                const imageData = hexaStringToBuffer(imageDataHex);
                if (!imageData) {
                  throw new Error("Invalid hex data");
                }
                const deviceAction = new UploadCustomLockScreenDeviceAction({
                  input: {
                    imageData,
                    unlockTimeout,
                  },
                  inspect,
                });
                return dmk.executeDeviceAction({
                  sessionId,
                  deviceAction,
                });
              },
              initialValues: {
                imageDataHex: "",
                unlockTimeout: UNLOCK_TIMEOUT,
              },
              validateValues: (values: { imageDataHex: string }) =>
                values.imageDataHex.length > 0 &&
                /^[0-9a-fA-F]*$/.test(values.imageDataHex),
              labelSelector: {
                imageDataHex: "Image Data (hex)",
                unlockTimeout: "unlockTimeout",
              },
              deviceModelId,
            } satisfies DeviceActionProps<
              UploadCustomLockScreenDAOutput,
              { imageDataHex: string; unlockTimeout: number },
              UploadCustomLockScreenDAError,
              UploadCustomLockScreenDAIntermediateValue
            >,
            {
              title: `${CLS_ICON} Upload Custom Lock Screen (Picture)`,
              description:
                "Upload a custom lock screen image from a picture file. The image will be automatically cropped, centered, and processed with dithering.",
              executeDeviceAction: (values: PictureInputValues, inspect) => {
                const imageData = hexaStringToBuffer(values.imageDataHex);
                if (!imageData) {
                  throw new Error("Invalid image data");
                }
                const deviceAction = new UploadCustomLockScreenDeviceAction({
                  input: {
                    imageData,
                    unlockTimeout: values.unlockTimeout,
                  },
                  inspect,
                });
                return dmk.executeDeviceAction({
                  sessionId,
                  deviceAction,
                });
              },
              initialValues: {
                imageDataHex: "",
                unlockTimeout: UNLOCK_TIMEOUT,
              } satisfies PictureInputValues,
              validateValues: (values: PictureInputValues) =>
                values.imageDataHex.length > 0,
              InputValuesComponent: ({
                initialValues,
                onChange,
                disabled,
              }: {
                initialValues: PictureInputValues;
                onChange: (values: PictureInputValues) => void;
                disabled?: boolean;
              }) => (
                <PictureInput
                  initialValues={initialValues}
                  onChange={onChange}
                  deviceModelId={deviceModelId}
                  disabled={disabled}
                />
              ),
              deviceModelId,
            } satisfies DeviceActionProps<
              UploadCustomLockScreenDAOutput,
              PictureInputValues,
              UploadCustomLockScreenDAError,
              UploadCustomLockScreenDAIntermediateValue
            >,
            {
              title: `${CLS_ICON} Fetch Custom Lock Screen`,
              description:
                "Retrieve the current custom lock screen image from the device. Optionally provide a backup hash to skip download if the image matches.",
              executeDeviceAction: (
                { backupHash, allowedEmpty, unlockTimeout },
                inspect,
              ) => {
                const deviceAction = new DownloadCustomLockScreenDeviceAction({
                  input: {
                    backupHash: backupHash || undefined,
                    allowedEmpty,
                    unlockTimeout,
                  },
                  inspect,
                });
                return dmk.executeDeviceAction({
                  sessionId,
                  deviceAction,
                });
              },
              initialValues: {
                backupHash: "",
                allowedEmpty: false,
                unlockTimeout: UNLOCK_TIMEOUT,
              },
              labelSelector: {
                backupHash: "Backup Hash (optional)",
                allowedEmpty: "Allow Empty",
                unlockTimeout: "unlockTimeout",
              },
              OutputComponent: DownloadOutput,
              deviceModelId,
            } satisfies DeviceActionProps<
              DownloadCustomLockScreenDAOutput,
              {
                backupHash: string;
                allowedEmpty: boolean;
                unlockTimeout: number;
              },
              DownloadCustomLockScreenDAError,
              DownloadCustomLockScreenDAIntermediateValue
            >,
            {
              title: `${CLS_ICON} Get Custom Lock Screen Info`,
              description:
                "Get information about the custom lock screen on the device, including whether one exists, its size in bytes, and its hash.",
              executeDeviceAction: ({ unlockTimeout }, inspect) => {
                const deviceAction = new GetCustomLockScreenInfoDeviceAction({
                  input: {
                    unlockTimeout,
                  },
                  inspect,
                });
                return dmk.executeDeviceAction({
                  sessionId,
                  deviceAction,
                });
              },
              initialValues: {
                unlockTimeout: UNLOCK_TIMEOUT,
              },
              deviceModelId,
            } satisfies DeviceActionProps<
              GetCustomLockScreenInfoDAOutput,
              GetCustomLockScreenInfoDAInput,
              GetCustomLockScreenInfoDAError,
              GetCustomLockScreenInfoDAIntermediateValue
            >,
            {
              title: `${CLS_ICON} Remove Custom Lock Screen`,
              description:
                "Remove the custom lock screen image from the device, restoring the default lock screen.",
              executeDeviceAction: ({ unlockTimeout }, inspect) => {
                const deviceAction = new RemoveCustomLockScreenDeviceAction({
                  input: {
                    unlockTimeout,
                  },
                  inspect,
                });
                return dmk.executeDeviceAction({
                  sessionId,
                  deviceAction,
                });
              },
              initialValues: {
                unlockTimeout: UNLOCK_TIMEOUT,
              },
              deviceModelId,
            } satisfies DeviceActionProps<
              RemoveCustomLockScreenDAOutput,
              RemoveCustomLockScreenDAInput,
              RemoveCustomLockScreenDAError,
              RemoveCustomLockScreenDAIntermediateValue
            >,
          ]
        : []),
    ],
    [clsSupported, deviceModelId, dmk, sessionId],
  );

  return (
    <DeviceActionsList title="Device actions" deviceActions={deviceActions} />
  );
};
