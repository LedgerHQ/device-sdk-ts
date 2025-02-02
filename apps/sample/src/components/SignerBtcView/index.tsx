import React, { useMemo } from "react";
import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  type GetExtendedDAIntermediateValue,
  type GetExtendedPublicKeyDAError,
  type GetExtendedPublicKeyDAOutput,
  type GetWalletAddressDAError,
  type GetWalletAddressDAIntermediateValue,
  type GetWalletAddressDAOutput,
  SignerBtcBuilder,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
  type SignPsbtDAError,
  type SignPsbtDAIntermediateValue,
  type SignPsbtDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-bitcoin";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import {
  descriptorTemplateToDerivationPath,
  GetWalletAddressInputValuesForm,
  SignPsbtDAInputValuesForm,
} from "@/components/SignerBtcView/SignPsbtDAInputValusForm";
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
        title: "Get wallet address",
        description:
          "Perform all the actions necessary to get the device's Bitcoin wallet address",
        executeDeviceAction: ({
          checkOnDevice,
          change,
          addressIndex,
          derivationPath,
          descriptorTemplate,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          return signer.getWalletAddress(
            new DefaultWallet(derivationPath, descriptorTemplate),
            Number(addressIndex),
            { checkOnDevice, change },
          );
        },
        InputValuesComponent: GetWalletAddressInputValuesForm,
        initialValues: {
          checkOnDevice: false,
          change: false,
          derivationPath: DEFAULT_DERIVATION_PATH,
          addressIndex: 0,
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
        },
        validateValues: ({ addressIndex }) => !isNaN(Number(addressIndex)),
        deviceModelId,
      } satisfies DeviceActionProps<
        GetWalletAddressDAOutput,
        {
          checkOnDevice: boolean;
          change: boolean;
          addressIndex: number;
          derivationPath: string;
          descriptorTemplate: DefaultDescriptorTemplate;
        },
        GetWalletAddressDAError,
        GetWalletAddressDAIntermediateValue
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
        executeDeviceAction: ({ descriptorTemplate, psbt, path }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          return signer.signPsbt(
            new DefaultWallet(path, descriptorTemplate),
            psbt,
          );
        },
        InputValuesComponent: SignPsbtDAInputValuesForm,
        initialValues: {
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          psbt: "",
          path: DEFAULT_DERIVATION_PATH,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPsbtDAOutput,
        {
          psbt: string;
          path: string;
          descriptorTemplate: DefaultDescriptorTemplate;
        },
        SignPsbtDAError,
        SignPsbtDAIntermediateValue
      >,
      {
        title: "Sign transaction",
        description:
          "Perform all the actions necessary to sign a PSBT with the device and extract transaction",
        executeDeviceAction: ({ descriptorTemplate, psbt, path }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          return signer.signTransaction(
            new DefaultWallet(path, descriptorTemplate),
            psbt,
          );
        },
        InputValuesComponent: SignPsbtDAInputValuesForm,
        initialValues: {
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          psbt: "",
          path: descriptorTemplateToDerivationPath[
            DefaultDescriptorTemplate.NATIVE_SEGWIT
          ],
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          psbt: string;
          path: string;
          descriptorTemplate: DefaultDescriptorTemplate;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Bitcoin Signer" deviceActions={deviceActions} />
  );
};
