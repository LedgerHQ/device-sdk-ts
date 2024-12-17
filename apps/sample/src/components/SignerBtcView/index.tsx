import React, { useMemo } from "react";
import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  SignerBtcBuilder,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
  type SignPsbtDAError,
  type SignPsbtDAIntermediateValue,
  type SignPsbtDAOutput,
} from "@ledgerhq/device-signer-kit-bitcoin";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { psbtB64 } from "@/components/SignerBtcView/psbt";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "84'/0'/0'";

export const SignerBitcoinView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = new SignerBtcBuilder({ dmk, sessionId }).build();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Sign message",
        description:
          "Perform all the actions necessary to sign a message with the device",
        executeDeviceAction: ({ derivationPath, message }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signMessage(derivationPath, message);
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
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
      {
        title: "Sign psbt",
        description:
          "Perform all the actions necessary to sign a PSBT with the device",
        executeDeviceAction: ({ derivationPath, psbt }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signPsbt(
            new DefaultWallet(derivationPath, DefaultDescriptorTemplate.LEGACY),
            psbt,
          );
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          psbt: psbtB64,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPsbtDAOutput,
        {
          psbt: string;
          derivationPath: string;
        },
        SignPsbtDAError,
        SignPsbtDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Bitcoin Signer" deviceActions={deviceActions} />
  );
};
