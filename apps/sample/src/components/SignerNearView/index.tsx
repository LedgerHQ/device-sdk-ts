import React, { useMemo } from "react";
import {
  type GetPublicKeyDAError,
  type GetPublicKeyDAIntermediateValue,
  type GetPublicKeyDAOutput,
  type GetVersionDAError,
  type GetVersionDAIntermediateValue,
  type GetVersionDAOutput,
  type GetWalletIdDAError,
  type GetWalletIdDAIntermediateValue,
  type GetWalletIdDAOutput,
  type SignDelegateDAError,
  type SignDelegateDAIntermediateValue,
  type SignDelegateDAOutput,
  SignerNearBuilder,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-near";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { signTransactionActions } from "@/components/SignerNearView/signTransactionActions";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "44'/397'/0'/0'/1";

export const SignerNearView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();

  const signer = useMemo(
    () => new SignerNearBuilder({ dmk, sessionId }).build(),
    [dmk, sessionId],
  );

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get public key",
        description:
          "Perform all the actions necessary to get an near public key from the device",
        executeDeviceAction: ({ derivationPath, ...args }, inspect) => {
          return signer.getPublicKey(derivationPath, { ...args, inspect });
        },
        deviceModelId,
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          checkOnDevice: true,
        },
      } satisfies DeviceActionProps<
        GetPublicKeyDAOutput,
        {
          derivationPath: string;
          checkOnDevice: boolean;
        },
        GetPublicKeyDAError,
        GetPublicKeyDAIntermediateValue
      >,
      {
        title: "Get wallet id",
        description:
          "Perform all the actions necessary to get a near wallet id from the device",
        executeDeviceAction: ({ derivationPath }, inspect) => {
          return signer.getWalletId(derivationPath, { inspect });
        },
        deviceModelId,
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
        },
      } satisfies DeviceActionProps<
        GetWalletIdDAOutput,
        {
          derivationPath: string;
        },
        GetWalletIdDAError,
        GetWalletIdDAIntermediateValue
      >,
      {
        title: "Get version",
        description:
          "Perform all the actions necessary to get a near wallet app version from the device",
        executeDeviceAction: (inspect) => {
          return signer.getVersion({ inspect });
        },
        deviceModelId,
        initialValues: undefined,
      } satisfies DeviceActionProps<
        GetVersionDAOutput,
        undefined,
        GetVersionDAError,
        GetVersionDAIntermediateValue
      >,
      {
        title: "Sign transaction",
        description:
          "Perform all the actions necessary sign a transaction from the device",
        executeDeviceAction: (
          { signerId, receiverId, derivationPath, ...actions },
          inspect,
        ) => {
          // const nonce = crypto.getRandomValues(new Uint32Array(1));
          const nearActions = Object.entries<boolean>(actions)
            .filter(
              ([action, enabled]) => signTransactionActions[action] && enabled,
            )
            .map(([action]) => signTransactionActions[action]());
          return signer.signTransaction(derivationPath, {
            signerId,
            receiverId,
            nonce: BigInt(0),
            actions: nearActions,
            blockHash: Uint8Array.from(new Array(32).fill(0)),
            inspect,
          });
        },
        deviceModelId,
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          signerId: "alice.near",
          receiverId: "bob.near",
          createAccount: false,
          stake: false,
          functionCall: false,
          transfer: false,
          addKey: false,
          deleteAccount: false,
          signedDelegate: false,
          deployContract: false,
        },
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          signerId: string;
          receiverId: string;
          createAccount: boolean;
          stake: boolean;
          functionCall: boolean;
          transfer: boolean;
          addKey: boolean;
          deleteAccount: boolean;
          signedDelegate: boolean;
          deployContract: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign NEP413 message",
        description:
          "Perform all the actions necessary sign a NEP413 message from the device",
        executeDeviceAction: ({ derivationPath, ...args }, inspect) => {
          const nonce = crypto.getRandomValues(new Uint8Array(32));
          return signer.signMessage(derivationPath, {
            ...args,
            nonce,
            inspect,
          });
        },
        deviceModelId,
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          message:
            "1Makes it possible to authenticate users without having to add new ac" +
            "cess keys. This will improve UX, save money and will not increase the on-chain storage " +
            "of the users' accounts./2Makes it possible to authenticate users without having to add n" +
            "ew access keys. This will improve UX, save money and will not increase the on-chain sto" +
            "rage of the users' accounts./3Makes it possible to authenticate users without having to " +
            "add new access keys. This will improve UX, save money and will not increase the on-chai" +
            "n storage of the users' accounts.",
          recipient: "alice.near",
          callbackUrl: "myapp.com/callback",
        },
      } satisfies DeviceActionProps<
        SignMessageDAOutput,
        {
          message: string;
          recipient: string;
          callbackUrl: string;
          derivationPath: string;
        },
        SignMessageDAError,
        SignMessageDAIntermediateValue
      >,
      {
        title: "Sign NEP366 delegate action",
        description:
          "Perform all the actions necessary sign a NEP366 delegate action from the device",
        executeDeviceAction: (
          { derivationPath, senderId, receiverId, ...actions },
          inspect,
        ) => {
          const nearActions = Object.entries<boolean>(actions)
            .filter(
              ([action, enabled]) => signTransactionActions[action] && enabled,
            )
            .map(([action]) => signTransactionActions[action]());
          return signer.signDelegate(derivationPath, {
            senderId,
            receiverId,
            nonce: BigInt(42 * 1e23),
            actions: nearActions,
            maxBlockHeight: BigInt(1e23),
            inspect,
          });
        },
        deviceModelId,
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          senderId: "bob.near",
          receiverId: "alice.near",
          stake: false,
          functionCall: false,
          transfer: false,
          deployContract: false,
          signedDelegate: false,
        },
      } satisfies DeviceActionProps<
        SignDelegateDAOutput,
        {
          derivationPath: string;
          senderId: string;
          receiverId: string;
          stake: boolean;
          functionCall: boolean;
          transfer: boolean;
          deployContract: boolean;
          signedDelegate: boolean;
        },
        SignDelegateDAError,
        SignDelegateDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Near" deviceActions={deviceActions} />
  );
};
