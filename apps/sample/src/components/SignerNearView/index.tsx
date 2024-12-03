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
        executeDeviceAction: (args, inspect) => {
          return signer.getPublicKey(args, inspect);
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
        executeDeviceAction: (args, inspect) => {
          return signer.getWalletId(args, inspect);
        },
        deviceModelId,
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          checkOnDevice: true,
        },
      } satisfies DeviceActionProps<
        GetWalletIdDAOutput,
        {
          derivationPath: string;
          checkOnDevice: boolean;
        },
        GetWalletIdDAError,
        GetWalletIdDAIntermediateValue
      >,
      {
        title: "Get version",
        description:
          "Perform all the actions necessary to get a near wallet app version from the device",
        executeDeviceAction: (inspect) => {
          return signer.getVersion(inspect);
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
          const nonce = crypto.getRandomValues(new Uint32Array(1));
          const nearActions = Object.entries<boolean>(actions)
            .filter(
              ([action, enabled]) => signTransactionActions[action] && enabled,
            )
            .map(([action]) => signTransactionActions[action]());
          return signer.signTransaction(
            {
              signerId,
              receiverId,
              nonce: BigInt(nonce[0]),
              actions: nearActions,
              blockHash: crypto.getRandomValues(new Uint8Array(32)),
              derivationPath,
            },
            inspect,
          );
        },
        deviceModelId,
        initialValues: {
          signerId:
            "c4f5941e81e071c2fd1dae2e71fd3d859d462484391d9a90bf219211dcbb320f",
          receiverId:
            "dc7e34eecec3096a4a661e10932834f801149c49dba9b93322f6d9de18047f9c",
          addKey: false,
          createAccount: false,
          deleteAccount: false,
          stake: false,
          transfer: false,
          derivationPath: DEFAULT_DERIVATION_PATH,
        },
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          signerId: string;
          receiverId: string;
          addKey: boolean;
          createAccount: boolean;
          deleteAccount: boolean;
          stake: boolean;
          transfer: boolean;
          derivationPath: string;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign message",
        description:
          "Perform all the actions necessary sign a NEP413 message from the device",
        executeDeviceAction: (args, inspect) => {
          const nonce = crypto.getRandomValues(new Uint8Array(32));
          return signer.signMessage({ ...args, nonce }, inspect);
        },
        deviceModelId,
        initialValues: {
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
          derivationPath: DEFAULT_DERIVATION_PATH,
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
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Keyring Near" deviceActions={deviceActions} />
  );
};
