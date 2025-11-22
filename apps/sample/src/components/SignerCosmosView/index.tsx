/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import {
  base64StringToBuffer,
  isBase64String,
} from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  SignDoc,
  SignerCosmosBuilder,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-cosmos";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "44'/118'/0'/0'";

export const SignerCosmosView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = new SignerCosmosBuilder({
    dmk,
    sessionId,
    originToken: "Cosmos",
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
          return signer.getAddress(derivationPath, "noble", {
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
        title: "Sign Transaction",
        description:
          "Perform all the actions necessary to sign a Solana transaction with the device",
        executeDeviceAction: ({ derivationPath, skipOpenApp, signDoc }) => {
          const serializedSignDoc =
            base64StringToBuffer(signDoc) ?? new Uint8Array();
          return signer.signTransaction(derivationPath, serializedSignDoc, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          signDoc: new SignDoc({
            chain_id: "boble-1",
            account_number: "1",
            sequence: "0",
            fee: {
              amount: [
                {
                  denom: "uusdc",
                  amount: "2000", // 0.002 USDC as fee (example)
                },
              ],
              gas: "80000",
            },
            memo: "dummy 0.1 uusdc transfer on boble",
            msgs: [
              {
                type: "cosmos-sdk/MsgSend",
                value: {
                  from_address: "noble19r4qdewyjnzp50usalc8sq96c6h5c3pe6v309r",
                  to_address: "noble19r4qdewyjnzp50usalc8sq96c6h5c3pe6v309r",
                  amount: [
                    {
                      denom: "uusdc",
                      amount: "100000", // 0.1 USDC in micro units
                    },
                  ],
                },
              },
            ],
          }).stringify(),

          skipOpenApp: false,
        },
        validateValues: ({ signDoc }) =>
          isBase64String(signDoc) && signDoc.length > 0,
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          signDoc: string;
          skipOpenApp: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Cosmos Signer" deviceActions={deviceActions} />
  );
};
