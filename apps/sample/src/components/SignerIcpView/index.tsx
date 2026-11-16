/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetVersionDAError,
  type GetVersionDAIntermediateValue,
  type GetVersionDAOutput,
  SignerIcpBuilder,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type SignUpdateCallDAError,
  type SignUpdateCallDAIntermediateValue,
  type SignUpdateCallDAOutput,
} from "@ledgerhq/device-signer-kit-icp";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const DEFAULT_DERIVATION_PATH = "44'/223'/0'/0/0";

// hexaStringToBuffer pads odd-length input with a leading zero nibble, which
// would silently change a CBOR payload: reject it instead.
const toBuffer = (value: string): Uint8Array | null => {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  const buffer = hex.length % 2 === 0 ? hexaStringToBuffer(hex) : null;
  return buffer && buffer.length > 0 ? buffer : null;
};

const isValidHex = (value: string): boolean => toBuffer(value) !== null;

// The tester calls executeDeviceAction outside any error handler, so a throw
// here is unhandled: validateValues keeps Execute disabled on invalid input.
const parseHex = (value: string, fieldName: string): Uint8Array => {
  const buffer = toBuffer(value);
  if (!buffer) {
    throw new Error(
      `Invalid ${fieldName}: expected non-empty, even-length hex`,
    );
  }
  return buffer;
};

export const SignerIcpView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useMemo(
    () => new SignerIcpBuilder({ dmk, sessionId }).build(),
    [dmk, sessionId],
  );

  const deviceModelId = dmk.getConnectedDevice({ sessionId }).modelId;

  const deviceActions = useMemo<DeviceActionProps<any, any, any, any>[]>(
    () => [
      {
        title: "Get address",
        description:
          "Perform all the actions necessary to get an ICP public key, account identifier and principal from the device",
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
          "Perform all the actions necessary to sign an ICP transaction with the device. The transaction is the hex-encoded CBOR request. Enable 'stake' to sign a neuron-creation transfer.",
        executeDeviceAction: ({
          derivationPath,
          transaction,
          stake,
          skipOpenApp,
        }) => {
          return signer.signTransaction(
            derivationPath,
            parseHex(transaction, "transaction"),
            { stake, skipOpenApp },
          );
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          transaction: "",
          stake: false,
          skipOpenApp: false,
        },
        validateValues: ({ transaction }) => isValidHex(transaction),
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          transaction: string;
          stake?: boolean;
          skipOpenApp?: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign update call",
        description:
          "Perform all the actions necessary to sign an IC update call and its read-state request (neuron management) with the device. Both are hex-encoded CBOR requests.",
        executeDeviceAction: ({
          derivationPath,
          callRequest,
          readStateRequest,
          skipOpenApp,
        }) => {
          return signer.signUpdateCall(
            derivationPath,
            parseHex(callRequest, "call request"),
            parseHex(readStateRequest, "read-state request"),
            { skipOpenApp },
          );
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          callRequest: "",
          readStateRequest: "",
          skipOpenApp: false,
        },
        validateValues: ({ callRequest, readStateRequest }) =>
          isValidHex(callRequest) && isValidHex(readStateRequest),
        deviceModelId,
      } satisfies DeviceActionProps<
        SignUpdateCallDAOutput,
        {
          derivationPath: string;
          callRequest: string;
          readStateRequest: string;
          skipOpenApp?: boolean;
        },
        SignUpdateCallDAError,
        SignUpdateCallDAIntermediateValue
      >,
      {
        title: "Get app configuration",
        description:
          "Perform all the actions necessary to get the ICP app configuration from the device",
        executeDeviceAction: () => {
          return signer.getAppConfiguration();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetVersionDAOutput,
        Record<string, never>,
        GetVersionDAError,
        GetVersionDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return <DeviceActionsList title="ICP Signer" deviceActions={deviceActions} />;
};
