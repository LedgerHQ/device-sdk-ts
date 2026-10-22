import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type AddressFormat,
  type BtcLegacyErrorCodes,
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetExtendedPublicKeyDAError,
  type GetExtendedPublicKeyDAIntermediateValue,
  type GetExtendedPublicKeyDAOutput,
  type LegacyCreateTransactionArg,
  type LegacyTransaction,
  LITECOIN_PROFILE,
  SignerBtcLegacyBuilder,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const addressFormatOptions: { label: string; value: AddressFormat }[] = [
  { label: "Legacy", value: "legacy" },
  { label: "P2SH", value: "p2sh" },
  { label: "Bech32", value: "bech32" },
];

type SignTransactionInput = {
  inputs: string;
  associatedKeysets: string;
  changePath: string;
  outputScriptHex: string;
  lockTime: string;
  skipOpenApp: boolean;
};

// Splits a raw transaction without SegWit data into the fields the signer
// takes, as hw-app-btc's splitTransaction does.
const splitTransaction = (hex: string): LegacyTransaction => {
  const bytes = hexaStringToBuffer(hex);
  if (bytes === null) {
    throw new Error("The previous transaction is not hexadecimal");
  }
  let offset = 0;
  const take = (length: number) => {
    if (offset + length > bytes.length) {
      throw new Error("The previous transaction is truncated");
    }
    offset += length;
    return bytes.slice(offset - length, offset);
  };
  const takeVarint = () => {
    const first = take(1)[0]!;
    if (first < 0xfd) return first;
    const size = first === 0xfd ? 2 : first === 0xfe ? 4 : 8;
    return take(size).reduceRight((value, byte) => value * 256 + byte, 0);
  };

  const version = take(4);
  const inputs = Array.from({ length: takeVarint() }, () => {
    const prevout = take(36);
    const script = take(takeVarint());
    return { prevout, script, sequence: take(4) };
  });
  const outputs = Array.from({ length: takeVarint() }, () => {
    const amount = take(8);
    return { amount, script: take(takeVarint()) };
  });
  const locktime = take(4);
  if (offset !== bytes.length) {
    throw new Error("The previous transaction has trailing data");
  }
  return { version, inputs, outputs, locktime };
};

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

// Each input is "<previous transaction hex>:<output index>[:<sequence>]".
const buildTransaction = ({
  inputs,
  associatedKeysets,
  changePath,
  outputScriptHex,
  lockTime,
}: SignTransactionInput): LegacyCreateTransactionArg => ({
  inputs: splitList(inputs).map((input) => {
    const [previousTransaction = "", outputIndex = "", sequence] =
      input.split(":");
    return [
      splitTransaction(previousTransaction),
      Number(outputIndex),
      null,
      sequence === undefined ? null : Number(sequence),
    ];
  }),
  associatedKeysets: splitList(associatedKeysets),
  changePath: changePath.trim() || undefined,
  outputScriptHex: outputScriptHex.trim(),
  lockTime: Number(lockTime || 0),
});

// A previous transaction paying 50 LTC to 44'/2'/0'/0/0 of the Speculos seed,
// at output 1.
const PREVIOUS_TRANSACTION =
  "0100000001423d1f6109a7d9173c218e7bdf5e2a9867c1ad07ee59c5eb1c204da052a0d9db000000006b480f531200a5ce6e67686b3e62f4a1faa3530ba0e12030eed116cdd8c790de4881eac6a223647223afd5b3bcdd4f587177229154ed44af5f3b6bde41864af3910b7995bff7b9ad05bf21021e339148aa57c4d4ccce6e3a0e403817ad1fee0270aaa99367348d3ee807b03effffffff0240ef5a07000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac0065cd1d000000001976a9146568ad6bf0606de398dc3e28fd1b2601a218bcef88ac00000000";

export const SignerLitecoinView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useMemo(
    () =>
      new SignerBtcLegacyBuilder({
        dmk,
        sessionId,
        profile: LITECOIN_PROFILE,
      }).build(),
    [dmk, sessionId],
  );

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get Address",
        description: "Get a Litecoin address from the device",
        executeDeviceAction: ({
          derivationPath,
          addressFormat,
          checkOnDevice,
          skipOpenApp,
        }) =>
          signer.getAddress(derivationPath, {
            addressFormat,
            checkOnDevice,
            skipOpenApp,
          }),
        initialValues: {
          derivationPath: "84'/2'/0'/0/0",
          addressFormat: "bech32",
          checkOnDevice: false,
          skipOpenApp: false,
        },
        valueSelector: {
          addressFormat: addressFormatOptions,
        },
        labelSelector: {
          derivationPath: "Derivation path",
          addressFormat: "Address format",
          checkOnDevice: "Check on device",
          skipOpenApp: "Skip open app",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          addressFormat: AddressFormat;
          checkOnDevice: boolean;
          skipOpenApp: boolean;
        },
        GetAddressDAError<BtcLegacyErrorCodes>,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Get extended public key",
        description: "Get the extended public key of a Litecoin account",
        executeDeviceAction: ({ derivationPath, skipOpenApp }) =>
          signer.getExtendedPublicKey(derivationPath, { skipOpenApp }),
        initialValues: {
          derivationPath: "84'/2'/0'",
          skipOpenApp: false,
        },
        labelSelector: {
          derivationPath: "Derivation path",
          skipOpenApp: "Skip open app",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetExtendedPublicKeyDAOutput,
        {
          derivationPath: string;
          skipOpenApp: boolean;
        },
        GetExtendedPublicKeyDAError<BtcLegacyErrorCodes>,
        GetExtendedPublicKeyDAIntermediateValue
      >,
      {
        title: "Sign Transaction",
        description:
          "Sign a Litecoin transaction without SegWit inputs, from raw previous transactions",
        executeDeviceAction: (values) =>
          signer.signTransaction(buildTransaction(values), {
            skipOpenApp: values.skipOpenApp,
          }),
        initialValues: {
          inputs: `${PREVIOUS_TRANSACTION}:1`,
          associatedKeysets: "44'/2'/0'/0/0",
          changePath: "",
          outputScriptHex:
            "01c022be1d000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
          lockTime: "0",
          skipOpenApp: false,
        },
        validateValues: (values) => {
          try {
            buildTransaction(values);
            return true;
          } catch {
            return false;
          }
        },
        labelSelector: {
          inputs: "Inputs (previous tx hex:output index[:sequence], ...)",
          associatedKeysets: "Derivation paths (comma-separated)",
          changePath: "Change derivation path",
          outputScriptHex: "Outputs hex",
          lockTime: "Lock time",
          skipOpenApp: "Skip open app",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        SignTransactionInput,
        SignTransactionDAError<BtcLegacyErrorCodes>,
        SignTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Litecoin" deviceActions={deviceActions} />
  );
};
