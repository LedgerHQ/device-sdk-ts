import React, { useMemo } from "react";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
  type GetViewKeyDAError,
  type GetViewKeyDAIntermediateValue,
  type GetViewKeyDAOutput,
  type SignFeeIntentDAError,
  type SignFeeIntentDAIntermediateValue,
  type SignFeeIntentDAOutput,
  type SignRootIntentDAError,
  type SignRootIntentDAIntermediateValue,
  type SignRootIntentDAOutput,
} from "@ledgerhq/device-signer-kit-aleo";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerAleo } from "@/providers/SignerAleoProvider";

const HEX_PREFIX_LENGTH = 2;

export const SignerAleoView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerAleo();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get App Config",
        description: "Get the app configuration from the device",
        executeDeviceAction: () => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAppConfig();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAppConfigDAOutput,
        Record<string, never>,
        GetAppConfigDAError,
        GetAppConfigDAIntermediateValue
      >,
      {
        title: "Get Address",
        description: "Get an address from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/683'/0",
          checkOnDevice: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          skipOpenApp?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Get View Key",
        description: "Get the view key from the device",
        executeDeviceAction: ({ derivationPath, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getViewKey(derivationPath, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/683'/0",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetViewKeyDAOutput,
        {
          derivationPath: string;
          skipOpenApp?: boolean;
        },
        GetViewKeyDAError,
        GetViewKeyDAIntermediateValue
      >,
      {
        title: "Sign Root Intent",
        description: "Sign a root intent with the device",
        executeDeviceAction: ({ derivationPath, rootIntent, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          // Convert hex string to Uint8Array
          const rootIntentBytes = rootIntent.startsWith("0x")
            ? new Uint8Array(
                rootIntent
                  .slice(HEX_PREFIX_LENGTH)
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              )
            : new Uint8Array(
                rootIntent
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              );
          return signer.signRootIntent(derivationPath, rootIntentBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/683'/0",
          rootIntent: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignRootIntentDAOutput,
        {
          derivationPath: string;
          rootIntent: string;
          skipOpenApp?: boolean;
        },
        SignRootIntentDAError,
        SignRootIntentDAIntermediateValue
      >,
      {
        title: "Sign Fee Intent",
        description: "Sign a fee intent with the device",
        executeDeviceAction: ({ feeIntent, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          // Convert hex string to Uint8Array
          const feeIntentBytes = feeIntent.startsWith("0x")
            ? new Uint8Array(
                feeIntent
                  .slice(HEX_PREFIX_LENGTH)
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              )
            : new Uint8Array(
                feeIntent.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ??
                  [],
              );
          return signer.signFeeIntent(feeIntentBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          feeIntent: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignFeeIntentDAOutput,
        {
          feeIntent: string;
          skipOpenApp?: boolean;
        },
        SignFeeIntentDAError,
        SignFeeIntentDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Aleo" deviceActions={deviceActions} />
  );
};
