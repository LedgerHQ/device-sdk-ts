import React, { useMemo } from "react";
import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  type GetExtendedDAIntermediateValue,
  type GetExtendedPublicKeyDAError,
  type GetExtendedPublicKeyDAOutput,
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
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "84'/0'/0'";

export const SignerBtcView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useMemo(
    () => new SignerBtcBuilder({ dmk, sessionId }).build(),
    [dmk, sessionId],
  );

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get extended public key",
        description:
          "Perform all the actions necessary to get a btc extended public key",
        executeDeviceAction: ({ derivationPath, checkOnDevice }) => {
          return signer.getExtendedPublicKey(derivationPath, {
            checkOnDevice,
          });
        },
        initialValues: {
          derivationPath: "84'/0'/0'",
          checkOnDevice: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetExtendedPublicKeyDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
        },
        GetExtendedPublicKeyDAError,
        GetExtendedDAIntermediateValue
      >,
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
            new DefaultWallet(
              derivationPath,
              DefaultDescriptorTemplate.NATIVE_SEGWIT,
            ),
            psbt,
          );
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          psbt: "70736274ff0104010101fb0402000000010204020000000105010100011004000000000103040100000001007102000000013daeeb9a92e7b5af90c787d53f0e60d2cf4cfd47bca9a0d8bc77a7464b024c0b00000000000000000002ff0300000000000016001402fe597c6ec0e2982712929bcf079a4e11d37e8d950b0000000000001600144dc432cb6a26c52a1e6ddd2bcf0ee49199fae0cc000000002206031869567d5e88d988ff7baf6827983f89530ddd79dbaeadaa6ec538a8f03dea8b18f5acc2fd540000800000008000000080000000000000000001011fff0300000000000016001402fe597c6ec0e2982712929bcf079a4e11d37e8d010e200cf08d04fa11ff024d5a50165ba65e495409b50ba6657788dfa15274adb682df010f0400000000000103086b01000000000000010416001429159115f12bb6a7e977439c83d3f8d555d72d5f00",
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
