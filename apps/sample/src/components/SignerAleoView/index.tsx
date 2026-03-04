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
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-aleo";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerAleo } from "@/providers/SignerAleoProvider";

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
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getViewKey(derivationPath, {
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
        GetViewKeyDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          skipOpenApp?: boolean;
        },
        GetViewKeyDAError,
        GetViewKeyDAIntermediateValue
      >,
      {
        title: "Sign Transaction",
        description: "Sign a transaction with the device",
        executeDeviceAction: ({ derivationPath, transaction, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          // Convert hex string to Uint8Array
          const txBytes = transaction.startsWith("0x")
            ? new Uint8Array(
                transaction
                  .slice(2)
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              )
            : new Uint8Array(
                transaction
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              );
          return signer.signTransaction(derivationPath, txBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/683'/0",
          transaction: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          transaction: string;
          skipOpenApp?: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Aleo" deviceActions={deviceActions} />
  );
};
