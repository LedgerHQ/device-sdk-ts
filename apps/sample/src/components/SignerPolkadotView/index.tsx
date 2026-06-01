import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-polkadot";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerPolkadot } from "@/providers/SignerPolkadotProvider";

export const SignerPolkadotView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerPolkadot();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get Address",
        description: "Get an address from the device",
        executeDeviceAction: ({
          derivationPath,
          ss58Prefix,
          checkOnDevice,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, Number(ss58Prefix), {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/0'/0'/0/0",
          ss58Prefix: "0",
          checkOnDevice: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          ss58Prefix: string;
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
          transaction,
          metadata,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const blob = hexaStringToBuffer(transaction) ?? new Uint8Array();
          const metadataBytes =
            hexaStringToBuffer(metadata) ?? new Uint8Array();
          return signer.signTransaction(derivationPath, blob, metadataBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/0'/0'/0/0",
          transaction: "",
          metadata: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          transaction: string;
          metadata: string;
          skipOpenApp?: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Polkadot" deviceActions={deviceActions} />
  );
};
