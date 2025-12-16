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
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const descriptorTemplateToDerivationPath: Record<
  DefaultDescriptorTemplate,
  string
> = {
  [DefaultDescriptorTemplate.TAPROOT]: "86'/0'/0'",
  [DefaultDescriptorTemplate.NATIVE_SEGWIT]: "84'/0'/0'",
  [DefaultDescriptorTemplate.NESTED_SEGWIT]: "49'/0'/0'",
  [DefaultDescriptorTemplate.LEGACY]: "44'/0'/0'",
};

const descriptorTemplateToLabel: Record<DefaultDescriptorTemplate, string> = {
  [DefaultDescriptorTemplate.TAPROOT]: "Taproot",
  [DefaultDescriptorTemplate.NATIVE_SEGWIT]: "Native Segwit",
  [DefaultDescriptorTemplate.NESTED_SEGWIT]: "Nested Segwit",
  [DefaultDescriptorTemplate.LEGACY]: "Legacy",
};

const descriptorTemplateOptions = Object.values(DefaultDescriptorTemplate).map(
  (value) => ({
    label: descriptorTemplateToLabel[value],
    value,
  }),
);

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
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          return signer.getExtendedPublicKey(derivationPath, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "84'/0'/0'",
          checkOnDevice: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetExtendedPublicKeyDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          skipOpenApp?: boolean;
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
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          return signer.getWalletAddress(
            new DefaultWallet(derivationPath, descriptorTemplate),
            Number(addressIndex),
            { checkOnDevice, change, skipOpenApp },
          );
        },
        initialValues: {
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          derivationPath: DEFAULT_DERIVATION_PATH,
          addressIndex: 0,
          change: false,
          checkOnDevice: false,
          skipOpenApp: false,
        },
        valueSelector: {
          descriptorTemplate: descriptorTemplateOptions,
        },
        labelSelector: {
          descriptorTemplate: "Wallet address type",
          derivationPath: "Derivation path",
          addressIndex: "Address index",
          change: "Change address",
          checkOnDevice: "Check on device",
          skipOpenApp: "Skip open app",
        },
        linkedFields: {
          descriptorTemplate: (newValue) => ({
            derivationPath:
              descriptorTemplateToDerivationPath[
                newValue as DefaultDescriptorTemplate
              ],
          }),
        },
        validateValues: ({ addressIndex }) => !isNaN(Number(addressIndex)),
        deviceModelId,
      } satisfies DeviceActionProps<
        GetWalletAddressDAOutput,
        {
          descriptorTemplate: DefaultDescriptorTemplate;
          derivationPath: string;
          addressIndex: number;
          change: boolean;
          checkOnDevice: boolean;
          skipOpenApp: boolean;
        },
        GetWalletAddressDAError,
        GetWalletAddressDAIntermediateValue
      >,
      {
        title: "Sign message",
        description:
          "Perform all the actions necessary to sign a message with the device",
        executeDeviceAction: ({ derivationPath, message, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signMessage(derivationPath, message, { skipOpenApp });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          message: "Hello World",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignMessageDAOutput,
        {
          derivationPath: string;
          message: string;
          skipOpenApp: boolean;
        },
        SignMessageDAError,
        SignMessageDAIntermediateValue
      >,
      {
        title: "Sign psbt",
        description:
          "Perform all the actions necessary to sign a PSBT with the device",
        executeDeviceAction: ({
          descriptorTemplate,
          psbt,
          path,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          return signer.signPsbt(
            new DefaultWallet(path, descriptorTemplate),
            psbt,
            { skipOpenApp },
          );
        },
        initialValues: {
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          path: DEFAULT_DERIVATION_PATH,
          psbt: "",
          skipOpenApp: false,
        },
        valueSelector: {
          descriptorTemplate: descriptorTemplateOptions,
        },
        labelSelector: {
          descriptorTemplate: "Wallet address type",
          path: "Derivation path",
          psbt: "PSBT",
          skipOpenApp: "Skip open app",
        },
        linkedFields: {
          descriptorTemplate: (newValue) => ({
            path: descriptorTemplateToDerivationPath[
              newValue as DefaultDescriptorTemplate
            ],
          }),
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPsbtDAOutput,
        {
          descriptorTemplate: DefaultDescriptorTemplate;
          path: string;
          psbt: string;
          skipOpenApp: boolean;
        },
        SignPsbtDAError,
        SignPsbtDAIntermediateValue
      >,
      {
        title: "Sign transaction",
        description:
          "Perform all the actions necessary to sign a PSBT with the device and extract transaction",
        executeDeviceAction: ({
          descriptorTemplate,
          psbt,
          path,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          return signer.signTransaction(
            new DefaultWallet(path, descriptorTemplate),
            psbt,
            { skipOpenApp },
          );
        },
        initialValues: {
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          path: DEFAULT_DERIVATION_PATH,
          psbt: "",
          skipOpenApp: false,
        },
        valueSelector: {
          descriptorTemplate: descriptorTemplateOptions,
        },
        labelSelector: {
          descriptorTemplate: "Wallet address type",
          path: "Derivation path",
          psbt: "PSBT",
          skipOpenApp: "Skip open app",
        },
        linkedFields: {
          descriptorTemplate: (newValue) => ({
            path: descriptorTemplateToDerivationPath[
              newValue as DefaultDescriptorTemplate
            ],
          }),
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          descriptorTemplate: DefaultDescriptorTemplate;
          path: string;
          psbt: string;
          skipOpenApp: boolean;
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
