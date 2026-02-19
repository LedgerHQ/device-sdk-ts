import React, { useMemo } from "react";
import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
} from "@ledgerhq/device-signer-kit-hyperliquid";
import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerHyperliquid } from "@/providers/SignerHyperliquidProvider";

export const SignerHyperliquidView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerHyperliquid();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
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
                  ?.map((byte) => parseInt(byte, 16)) ?? []
              )
            : new Uint8Array(
                transaction
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? []
              );
          return signer.signTransaction(derivationPath, txBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/0'/0'/0/0",
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
      {
        title: "Sign Message",
        description: "Sign a message with the device",
        executeDeviceAction: ({ derivationPath, message }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signMessage(derivationPath, message);
        },
        initialValues: {
          derivationPath: "44'/0'/0'/0/0",
          message: "Hello World",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignMessageDAOutput,
        {
          derivationPath: string;
          message: string;
        },
        SignMessageDAError,
        SignMessageDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Hyperliquid" deviceActions={deviceActions} />
  );
};
