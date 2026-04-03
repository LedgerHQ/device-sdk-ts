/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetVersionDAError,
  type GetVersionDAIntermediateValue,
  type GetVersionDAOutput,
  SignerSuiBuilder,
  type SignPersonalMessageDAError,
  type SignPersonalMessageDAIntermediateValue,
  type SignPersonalMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-sui";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "44'/784'/0'/0'/0'";

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/i, "").replace(/\s/g, "");
  if (!/^([0-9a-fA-F]{2})*$/.test(cleanHex)) {
    throw new Error("Invalid hex string");
  }
  return Uint8Array.from(
    cleanHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
  );
}

export const SignerSuiView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = new SignerSuiBuilder({
    dmk,
    sessionId,
  }).build();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  const deviceActions = useMemo<DeviceActionProps<any, any, any, any>[]>(
    () => [
      {
        title: "Get version",
        description:
          "Retrieve the Sui app version from the connected Ledger device",
        executeDeviceAction: () => {
          return signer.getVersion();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetVersionDAOutput,
        Record<string, never>,
        GetVersionDAError,
        GetVersionDAIntermediateValue
      >,
      {
        title: "Get address",
        description:
          "Retrieve a Sui address (public key + address) from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          checkOnDevice: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice: boolean;
          skipOpenApp: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Sign transaction",
        description:
          "Sign a Sui transaction on the device. Provide the intent-wrapped transaction bytes as hex.",
        executeDeviceAction: ({
          derivationPath,
          transaction,
          skipOpenApp,
        }) => {
          const txBytes = hexToBytes(transaction);
          return signer.signTransaction(derivationPath, txBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          transaction: "",
          skipOpenApp: false,
        },
        validateValues: ({ transaction }) => {
          try {
            const cleanHex = transaction
              .replace(/^0x/i, "")
              .replace(/\s/g, "");
            return /^([0-9a-fA-F]{2})+$/.test(cleanHex);
          } catch {
            return false;
          }
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          transaction: string;
          skipOpenApp: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign personal message",
        description:
          "Sign a personal message on the device. Provide the intent-wrapped message bytes as hex.",
        executeDeviceAction: ({
          derivationPath,
          message,
          skipOpenApp,
        }) => {
          const msgBytes = hexToBytes(message);
          return signer.signPersonalMessage(derivationPath, msgBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          message: "",
          skipOpenApp: false,
        },
        validateValues: ({ message }) => {
          try {
            const cleanHex = message.replace(/^0x/i, "").replace(/\s/g, "");
            return /^([0-9a-fA-F]{2})+$/.test(cleanHex);
          } catch {
            return false;
          }
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPersonalMessageDAOutput,
        {
          derivationPath: string;
          message: string;
          skipOpenApp: boolean;
        },
        SignPersonalMessageDAError,
        SignPersonalMessageDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Sui Signer" deviceActions={deviceActions} />
  );
};
