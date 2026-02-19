import React, { useMemo } from "react";
import type {
  SignActionsDAError,
  SignActionsDAIntermediateValue,
  SignActionsDAOutput,
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
        title: "Sign Actions",
        description: "Sign a Actions with the device",
        executeDeviceAction: ({ derivationPath, Actions, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          // Convert hex string to Uint8Array
          const txBytes = Actions.startsWith("0x")
            ? new Uint8Array(
                Actions.slice(2)
                  .match(/.{1,2}/g)
                  ?.map((byte) => parseInt(byte, 16)) ?? [],
              )
            : new Uint8Array(
                Actions.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ??
                  [],
              );
          return signer.signActions(derivationPath, txBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/0'/0'/0/0",
          Actions: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignActionsDAOutput,
        {
          derivationPath: string;
          Actions: string;
          skipOpenApp?: boolean;
        },
        SignActionsDAError,
        SignActionsDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList
      title="Signer Hyperliquid"
      deviceActions={deviceActions}
    />
  );
};
