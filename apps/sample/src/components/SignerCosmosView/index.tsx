import React, { useMemo } from "react";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-cosmos";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { dummySignDocJson } from "@/components/SignerCosmosView/JsonTransaction";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerCosmos } from "@/providers/SignerCosmosProvider";

export const SignerCosmosView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerCosmos();

  const DEFAULT_DERIVATION_PATH = "44'/118'/0'/0/0";
  const DEFAULT_HRP = "cosmos";

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
          hrp,
          checkOnDevice,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, hrp, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          hrp: DEFAULT_HRP,
          checkOnDevice: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          hrp: string;
          checkOnDevice?: boolean;
          skipOpenApp?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Sign Transaction",
        description: "Sign a transaction with the device",
        executeDeviceAction: ({
          derivationPath,
          hrp,
          transaction,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const txBytes = new TextEncoder().encode(transaction);
          return signer.signTransaction(derivationPath, hrp, txBytes, {
            skipOpenApp,
          });
        },
        validateValues: ({ transaction }) => {
          return transaction.length > 0;
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          hrp: DEFAULT_HRP,
          transaction: JSON.stringify(dummySignDocJson),
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          hrp: string;
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
    <DeviceActionsList title="Signer Cosmos" deviceActions={deviceActions} />
  );
};
