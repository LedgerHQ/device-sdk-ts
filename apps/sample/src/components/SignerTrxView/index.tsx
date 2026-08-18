/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
  type GetECDHSecretDAError,
  type GetECDHSecretDAIntermediateValue,
  type GetECDHSecretDAOutput,
  SignerTrxBuilder,
  type SignPersonalMessageDAError,
  type SignPersonalMessageDAIntermediateValue,
  type SignPersonalMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type SignTransactionHashDAError,
  type SignTransactionHashDAIntermediateValue,
  type SignTransactionHashDAOutput,
} from "@ledgerhq/device-signer-kit-tron";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "44'/195'/0'/0/0";

export const SignerTrxView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useMemo(
    () => new SignerTrxBuilder({ dmk, sessionId }).build(),
    [dmk, sessionId],
  );

  const deviceModelId = dmk.getConnectedDevice({ sessionId }).modelId;

  const deviceActions = useMemo<DeviceActionProps<any, any, any, any>[]>(
    () => [
      {
        title: "Get address",
        description:
          "Perform all the actions necessary to get a Tron address from the device",
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
          checkOnDevice?: boolean;
          skipOpenApp?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Sign transaction",
        description:
          "Perform all the actions necessary to sign a Tron transaction with the device. The transaction is the hex-encoded protobuf-serialized raw_data of the transaction, reviewed and blind-signed on-device.",
        executeDeviceAction: ({ derivationPath, transaction, skipOpenApp }) => {
          const tx = hexaStringToBuffer(transaction);
          if (!tx || tx.length === 0) {
            throw new Error("Invalid transaction format");
          }
          return signer.signTransaction(derivationPath, tx, { skipOpenApp });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
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
        title: "Sign transaction hash",
        description:
          "Perform all the actions necessary to sign a transaction hash (hex-encoded 32-byte hash of the protobuf-serialized raw_data) with the device. Requires the 'sign by hash' setting to be enabled in the Tron app.",
        executeDeviceAction: ({
          derivationPath,
          transactionHash,
          skipOpenApp,
        }) => {
          const hash = hexaStringToBuffer(transactionHash);
          if (!hash || hash.length === 0) {
            throw new Error("Invalid transaction hash format");
          }
          return signer.signTransactionHash(derivationPath, hash, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          transactionHash: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionHashDAOutput,
        {
          derivationPath: string;
          transactionHash: string;
          skipOpenApp?: boolean;
        },
        SignTransactionHashDAError,
        SignTransactionHashDAIntermediateValue
      >,
      {
        title: "Sign personal message",
        description:
          "Perform all the actions necessary to sign a personal message with the device",
        executeDeviceAction: ({ derivationPath, message, skipOpenApp }) => {
          return signer.signPersonalMessage(derivationPath, message, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          message: "Hello World",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPersonalMessageDAOutput,
        {
          derivationPath: string;
          message: string;
          skipOpenApp?: boolean;
        },
        SignPersonalMessageDAError,
        SignPersonalMessageDAIntermediateValue
      >,
      {
        title: "Get app configuration",
        description:
          "Perform all the actions necessary to get the Tron app configuration from the device",
        executeDeviceAction: () => {
          return signer.getAppConfiguration();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAppConfigurationDAOutput,
        Record<string, never>,
        GetAppConfigurationDAError,
        GetAppConfigurationDAIntermediateValue
      >,
      {
        title: "Get ECDH secret",
        description:
          "Perform all the actions necessary to compute an ECDH shared secret between the device key and a peer's public key (hex-encoded 65-byte uncompressed secp256k1 key). Requires approval on the device.",
        executeDeviceAction: ({ derivationPath, publicKey, skipOpenApp }) => {
          const key = hexaStringToBuffer(publicKey);
          if (!key || key.length === 0) {
            throw new Error("Invalid public key format");
          }
          return signer.getECDHSecret(derivationPath, key, { skipOpenApp });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          publicKey:
            "04ff21f8e64d3a3c0198edfbb7afdc79be959432e92e2f8a1984bb436a414b8edcec0345aad0c1bf7da04fd036dd7f9f617e30669224283d950fab9dd84831dc83",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetECDHSecretDAOutput,
        {
          derivationPath: string;
          publicKey: string;
          skipOpenApp?: boolean;
        },
        GetECDHSecretDAError,
        GetECDHSecretDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Tron Signer" deviceActions={deviceActions} />
  );
};
