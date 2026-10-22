import React, { useMemo } from "react";
import {
  type BtcLegacyErrorCodes,
  DOGECOIN_PROFILE,
  SignerBtcLegacyBuilder,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import {
  buildTransaction,
  type SignTransactionInput,
} from "@/utils/btcLegacyTransaction";

// A previous transaction paying 5,000 DOGE to 44'/3'/0'/0/0 of the Speculos
// seed, at output 1.
const PREVIOUS_TRANSACTION =
  "0100000001eaa8d810c854b9a614cc52aa9ee0e0c99fdd31ac086a0e61041f0007b7e44430000000006b48cf81c68923784e6e33d1a8f559a8ad75a3952dec6f577c2f9abb0ffe07ae2cf54983e718f733716188ac89ca51dcb3649f245bb31ec0548f2d5ae8d193c7294a3f0a0f56bd615c5621026024f7fc94cc49426df9687f8c146eb04464f3e3d3fa867e408a68738a2a8a1bffffffff0280588d49000000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac00f2052a010000001976a9144fb4f23b006689f3fef238ab8305899250ab750b88ac00000000";

export const SignerDogecoinView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useMemo(
    () =>
      new SignerBtcLegacyBuilder({
        dmk,
        sessionId,
        profile: DOGECOIN_PROFILE,
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
        title: "Sign Transaction",
        description:
          "Sign a Dogecoin transaction without SegWit inputs, from raw previous transactions",
        executeDeviceAction: (values) =>
          signer.signTransaction(buildTransaction(values), {
            skipOpenApp: values.skipOpenApp,
          }),
        initialValues: {
          inputs: `${PREVIOUS_TRANSACTION}:1`,
          associatedKeysets: "44'/3'/0'/0/0",
          changePath: "",
          outputScriptHex:
            "01805b6d29010000001976a914ba14e4e64c1e23f8b113f1d32d4ec7777e61451488ac",
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
    <DeviceActionsList title="Signer Dogecoin" deviceActions={deviceActions} />
  );
};
