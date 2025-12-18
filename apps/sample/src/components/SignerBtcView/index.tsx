import React, { useMemo } from "react";
import {
  hexaStringToBuffer,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  type GetExtendedDAIntermediateValue,
  type GetExtendedPublicKeyDAError,
  type GetExtendedPublicKeyDAOutput,
  type GetMasterFingerprintDAError,
  type GetMasterFingerprintDAIntermediateValue,
  type GetMasterFingerprintDAOutput,
  type GetWalletAddressDAError,
  type GetWalletAddressDAIntermediateValue,
  type GetWalletAddressDAOutput,
  RegisteredWallet,
  type RegisterWalletDAError,
  type RegisterWalletDAIntermediateValue,
  type RegisterWalletDAOutput,
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
  WalletPolicy,
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
        title: "Get master fingerprint",
        description:
          "Get the master fingerprint of the wallet (4-byte identifier derived from the master public key)",
        executeDeviceAction: ({ skipOpenApp }) => {
          return signer.getMasterFingerprint({
            skipOpenApp,
          });
        },
        initialValues: {
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetMasterFingerprintDAOutput,
        {
          skipOpenApp?: boolean;
        },
        GetMasterFingerprintDAError,
        GetMasterFingerprintDAIntermediateValue
      >,
      {
        title: "Register wallet",
        description:
          "Register a custom wallet policy on the device (e.g., multisig). Returns an HMAC for future use.",
        executeDeviceAction: ({
          name,
          descriptorTemplate,
          keys,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          const walletPolicy = new WalletPolicy(
            name,
            descriptorTemplate,
            keys.split(",").filter((k: string) => k.trim() !== ""),
          );
          return signer.registerWallet(walletPolicy, { skipOpenApp });
        },
        initialValues: {
          name: "My Multisig",
          descriptorTemplate: "wsh(sortedmulti(2,@0/**,@1/**))",
          keys: "[76223a6e/48'/1'/0'/2']tpubDE7NQymr4AFtewpAsWtnreyq9ghkzQBXpCZjWLFVRAvnbf7vya2eMTvT2fPapNqL8SuVvLQdbUbMfWLVDCZKnsEBqp6UK93QEzL8Ck23AwF,[f5acc2fd/48'/1'/0'/2']tpubDFAqEGNyad35aBCKUAXbQGDjdVhNueno5ZZVEn3sQbW5ci457gLR7HyTmHBg93oourBssgUxuWz1jX5uhc1qaqFo9VsybY1J5FuedLfm4dK",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        RegisterWalletDAOutput,
        {
          name: string;
          descriptorTemplate: string;
          keys: string;
          skipOpenApp?: boolean;
        },
        RegisterWalletDAError,
        RegisterWalletDAIntermediateValue
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
        InputValuesComponent: GetWalletAddressInputValuesForm,
        initialValues: {
          checkOnDevice: false,
          change: false,
          derivationPath: DEFAULT_DERIVATION_PATH,
          addressIndex: 0,
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          skipOpenApp: false,
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
          skipOpenApp: boolean;
        },
        GetWalletAddressDAError,
        GetWalletAddressDAIntermediateValue
      >,
      {
        title: "Get wallet address (Registered Wallet)",
        description:
          "Get an address from a registered wallet policy (e.g., multisig). Requires the HMAC from wallet registration.",
        executeDeviceAction: ({
          name,
          descriptorTemplate,
          keys,
          hmac,
          checkOnDevice,
          change,
          addressIndex,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          const registeredWallet = new RegisteredWallet(
            name,
            descriptorTemplate,
            keys.split(",").map((k: string) => k.trim()),
            hexaStringToBuffer(hmac)!,
          );

          return signer.getWalletAddress(
            registeredWallet,
            Number(addressIndex),
            {
              checkOnDevice,
              change,
              skipOpenApp,
            },
          );
        },
        initialValues: {
          name: "My Multisig",
          descriptorTemplate: "wsh(sortedmulti(2,@0/**,@1/**))",
          keys: "[76223a6e/48'/1'/0'/2']tpubDE7NQymr4AFtewpAsWtnreyq9ghkzQBXpCZjWLFVRAvnbf7vya2eMTvT2fPapNqL8SuVvLQdbUbMfWLVDCZKnsEBqp6UK93QEzL8Ck23AwF,[f5acc2fd/48'/1'/0'/2']tpubDFAqEGNyad35aBCKUAXbQGDjdVhNueno5ZZVEn3sQbW5ci457gLR7HyTmHBg93oourBssgUxuWz1jX5uhc1qaqFo9VsybY1J5FuedLfm4dK",
          hmac: "",
          checkOnDevice: false,
          change: false,
          addressIndex: 0,
          skipOpenApp: false,
        },
        validateValues: ({ addressIndex, hmac }) =>
          !isNaN(Number(addressIndex)) && isHexaString(hmac),
        deviceModelId,
      } satisfies DeviceActionProps<
        GetWalletAddressDAOutput,
        {
          name: string;
          descriptorTemplate: string;
          keys: string;
          hmac: string;
          checkOnDevice: boolean;
          change: boolean;
          addressIndex: number;
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
        InputValuesComponent: SignPsbtDAInputValuesForm,
        initialValues: {
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          psbt: "",
          path: DEFAULT_DERIVATION_PATH,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPsbtDAOutput,
        {
          psbt: string;
          path: string;
          descriptorTemplate: DefaultDescriptorTemplate;
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
        InputValuesComponent: SignPsbtDAInputValuesForm,
        initialValues: {
          descriptorTemplate: DefaultDescriptorTemplate.NATIVE_SEGWIT,
          psbt: "",
          path: descriptorTemplateToDerivationPath[
            DefaultDescriptorTemplate.NATIVE_SEGWIT
          ],
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          psbt: string;
          path: string;
          descriptorTemplate: DefaultDescriptorTemplate;
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
