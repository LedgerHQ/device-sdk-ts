import React from "react";
import { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
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
import {
  DeviceActionsList,
  UNLOCK_TIMEOUT,
} from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const CLS_ICON = "🖼️";

export const LedgerWalletDeviceActions: React.FC<{ sessionId: string }> = ({
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
    () =>
      clsSupported
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
        : [],
    [clsSupported, deviceModelId, dmk, sessionId],
  );

  return (
    <DeviceActionsList
      title="Ledger Wallet"
      deviceActions={deviceActions}
      noActionsMessage="Custom lock screen is not supported on this device."
    />
  );
};
