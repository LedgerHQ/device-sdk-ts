/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import {
  base64StringToBuffer,
  isBase64String,
} from "@ledgerhq/device-management-kit";
import {
  type CraftTransactionDAError,
  type CraftTransactionDAIntermediateValue,
  type CraftTransactionDAOutput,
  type GenerateTransactionDAError,
  type GenerateTransactionDAIntermediateValue,
  type GenerateTransactionDAOutput,
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
  SignerSolanaBuilder,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  SolanaToolsBuilder,
} from "@ledgerhq/device-signer-kit-solana";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "44'/501'/0'/0'";

export const SignerSolanaView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = new SignerSolanaBuilder({
    dmk,
    sessionId,
    originToken: "Solana",
  }).build();
  const solanaTools = new SolanaToolsBuilder({
    dmk,
    sessionId,
    originToken: "Solana",
  }).build();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  const deviceActions = useMemo<DeviceActionProps<any, any, any, any>[]>(
    () => [
      {
        title: "Get address",
        description:
          "Perform all the actions necessary to get a Solana address from the device",
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
          "Perform all the actions necessary to sign a Solana transaction with the device",
        executeDeviceAction: ({ derivationPath, transaction }) => {
          const serializedTransaction =
            base64StringToBuffer(transaction) ?? new Uint8Array();
          return signer.signTransaction(derivationPath, serializedTransaction);
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          transaction: "",
          skipOpenApp: false,
        },
        validateValues: ({ transaction }) =>
          isBase64String(transaction) && transaction.length > 0,
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
        title: "Sign off chain message",
        description:
          "Perform all the actions necessary to sign a solana off-chain message from the device",
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
        { derivationPath: string; message: string; skipOpenApp: boolean },
        SignMessageDAError,
        SignMessageDAIntermediateValue
      >,
      {
        title: "Get app configuration",
        description:
          "Perform all the actions necessary to get the Solana app configuration from the device",
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
        title: "Generate transaction",
        description:
          "Perform all the actions necessary to generate a transaction to test the Solana signer",
        executeDeviceAction: ({ derivationPath }) => {
          return solanaTools.generateTransaction(derivationPath);
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GenerateTransactionDAOutput,
        {
          derivationPath: string;
        },
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >,
      {
        title: "Craft a Solana transaction",
        description:
          "Perform all the actions necessary to craft a Solana transaction with your public key as the fee payer",
        executeDeviceAction: ({ derivationPath, serialisedTransaction }) => {
          return solanaTools.craftTransaction(
            derivationPath,
            serialisedTransaction,
          );
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          serialisedTransaction: "",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        CraftTransactionDAOutput,
        {
          derivationPath: string;
          serialisedTransaction: string;
        },
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, solanaTools, signer],
  );

  return (
    <DeviceActionsList title="Solana Signer" deviceActions={deviceActions} />
  );
};
