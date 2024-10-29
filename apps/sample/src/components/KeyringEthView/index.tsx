import React, { useMemo } from "react";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type SignPersonalMessageDAError,
  type SignPersonalMessageDAIntermediateValue,
  type SignPersonalMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type SignTypedDataDAError,
  type SignTypedDataDAIntermediateValue,
  type SignTypedDataDAOutput,
  type TypedData,
} from "@ledgerhq/device-signer-kit-ethereum";
import { ethers } from "ethers";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useKeyringEth } from "@/providers/KeyringEthProvider";

export const KeyringEthView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const sdk = useSdk();
  const keyring = useKeyringEth();

  const deviceModelId = sdk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get address",
        description:
          "Perform all the actions necessary to get an ethereum address from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          returnChainCode,
        }) => {
          if (!keyring) {
            throw new Error("Keyring not initialized");
          }
          return keyring.getAddress(derivationPath, {
            checkOnDevice,
            returnChainCode,
          });
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          checkOnDevice: false,
          returnChainCode: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          returnChainCode?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Sign message",
        description:
          "Perform all the actions necessary to sign a message with the device",
        executeDeviceAction: ({ derivationPath, message }) => {
          if (!keyring) {
            throw new Error("Keyring not initialized");
          }
          return keyring.signMessage(derivationPath, message);
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello World",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPersonalMessageDAOutput,
        {
          derivationPath: string;
          message: string;
        },
        SignPersonalMessageDAError,
        SignPersonalMessageDAIntermediateValue
      >,
      {
        title: "Sign transaction",
        description:
          "Perform all the actions necessary to sign a transaction with the device",
        executeDeviceAction: ({
          derivationPath,
          transaction,
          recipientDomain,
        }) => {
          if (!keyring) {
            throw new Error("Keyring not initialized");
          }
          return keyring.signTransaction(
            derivationPath,
            ethers.Transaction.from(transaction),
            { domain: recipientDomain },
          );
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: "",
          recipientDomain: "",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          transaction: string;
          recipientDomain: string;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign typed message",
        description:
          "Perform all the actions necessary to sign a typed message on the device",
        executeDeviceAction: ({ derivationPath, message }) => {
          const typedData = JSON.parse(message) as TypedData;

          if (!keyring) {
            throw new Error("Keyring not initialized");
          }
          return keyring.signTypedData(derivationPath, typedData);
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          message: `{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}`,
        },
        validateValues: ({ message }) => {
          try {
            const parsedData = JSON.parse(message);
            if (
              typeof parsedData !== "object" ||
              typeof parsedData.domain !== "object" ||
              typeof parsedData.types !== "object" ||
              typeof parsedData.primaryType !== "string" ||
              typeof parsedData.message !== "object"
            ) {
              console.log(
                `Invalid typed message format: should conform to EIP712 specification`,
              );
              return false;
            }
          } catch (error) {
            console.log(`Invalid typed message format (${error})`);
            return false;
          }
          return true;
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTypedDataDAOutput,
        {
          derivationPath: string;
          message: string;
        },
        SignTypedDataDAError,
        SignTypedDataDAIntermediateValue
      >,
    ],
    [deviceModelId, keyring],
  );

  return (
    <DeviceActionsList title="Keyring Ethereum" deviceActions={deviceActions} />
  );
};
