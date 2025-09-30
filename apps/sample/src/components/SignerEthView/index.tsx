import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type SignDelegationAuthorizationDAError,
  type SignDelegationAuthorizationDAIntermediateValue,
  type SignDelegationAuthorizationDAOutput,
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
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerEth } from "@/providers/SignerEthProvider";

export const SignerEthView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerEth();

  const deviceModelId = dmk.getConnectedDevice({
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
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            returnChainCode,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          checkOnDevice: false,
          returnChainCode: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          returnChainCode?: boolean;
          skipOpenApp?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
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
          derivationPath: "44'/60'/0'/0/0",
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
        title: "Sign transaction",
        description:
          "Perform all the actions necessary to sign a transaction with the device (JSON or serialized raw TX)",
        executeDeviceAction: ({
          derivationPath,
          transaction,
          recipientDomain,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }

          let rawTx: string;

          // Try to parse as JSON, otherwise treat as raw serialized transaction
          try {
            const jsonTx = JSON.parse(transaction);
            // Remove "from" if present, as it's not needed for unsigned txs
            if ("from" in jsonTx) {
              delete jsonTx.from;
            }
            rawTx = ethers.Transaction.from(jsonTx).unsignedSerialized;
          } catch {
            // Not JSON, assume already a serialized transaction
            rawTx = ethers.Transaction.from(transaction).unsignedSerialized;
          }

          const tx = hexaStringToBuffer(rawTx);
          if (!tx) {
            throw new Error("Invalid transaction format");
          }

          return signer.signTransaction(derivationPath, tx, {
            domain: recipientDomain,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: "",
          recipientDomain: "",
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          transaction: string;
          recipientDomain: string;
          skipOpenApp?: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign typed message",
        description:
          "Perform all the actions necessary to sign a typed message on the device",
        executeDeviceAction: ({ derivationPath, message, skipOpenApp }) => {
          const typedData = JSON.parse(message) as TypedData;

          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signTypedData(derivationPath, typedData, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          message: `{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}`,
          skipOpenApp: false,
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
          skipOpenApp?: boolean;
        },
        SignTypedDataDAError,
        SignTypedDataDAIntermediateValue
      >,
      {
        title: "Sign Delegation Authorization",
        description:
          "Perform all the actions necessary to sign an EIP 7702 Delegation Authorization with the device",
        executeDeviceAction: ({
          derivationPath,
          nonce,
          contractAddress,
          chainId,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signDelegationAuthorization(
            derivationPath,
            chainId,
            contractAddress,
            nonce,
          );
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0/0",
          nonce: 0,
          contractAddress: "0x",
          chainId: 1,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignDelegationAuthorizationDAOutput,
        {
          derivationPath: string;
          nonce: number;
          contractAddress: string;
          chainId: number;
        },
        SignDelegationAuthorizationDAError,
        SignDelegationAuthorizationDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Ethereum" deviceActions={deviceActions} />
  );
};
