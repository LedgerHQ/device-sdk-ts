import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
  type GetFullViewingKeyDAError,
  type GetFullViewingKeyDAIntermediateValue,
  type GetFullViewingKeyDAOutput,
  type GetTrustedInputDAError,
  type GetTrustedInputDAIntermediateValue,
  type GetTrustedInputDAOutput,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type ZcashFullViewingKeyMode,
} from "@ledgerhq/device-signer-kit-zcash";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { type ValueSelector } from "@/components/Form";
import { type FieldType } from "@/hooks/useForm";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerZcash } from "@/providers/SignerZcashProvider";

const fullViewingKeyModeOptions: ValueSelector<FieldType>["mode"] = [
  { label: "UFVK (string, P2=0x00)", value: "ufvk" },
  { label: "Orchard FVK (96 raw bytes, P2=0x01)", value: "orchardFvk" },
];

export const SignerZcashView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerZcash();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get App Config",
        description: "Get the app configuration from the device",
        executeDeviceAction: () => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAppConfig();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAppConfigDAOutput,
        Record<string, never>,
        GetAppConfigDAError,
        GetAppConfigDAIntermediateValue
      >,
      {
        title: "Get Address",
        description: "Get an address from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/133'/0'/0/0",
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
        title: "Get Full Viewing Key",
        description:
          "Exports a full viewing key (UFVK/FVK) from the device. It does not spend funds, but it allows watching shielded balance and activity for this derivation — treat it as highly sensitive secret material. Do not share, log, or commit sample output; use only for local SDK testing.",
        executeDeviceAction: ({ derivationPath, mode, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const resolvedMode: ZcashFullViewingKeyMode =
            mode === "orchardFvk" ? "orchardFvk" : "ufvk";
          return signer.getFullViewingKey(derivationPath, {
            mode: resolvedMode,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "32'/133'/0'",
          mode: "ufvk",
          skipOpenApp: false,
        },
        valueSelector: { mode: fullViewingKeyModeOptions },
        labelSelector: {
          mode: "Export mode (GET_VK P2)",
          derivationPath: "Derivation path",
          skipOpenApp: "Skip open app",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetFullViewingKeyDAOutput,
        {
          derivationPath: string;
          mode: ZcashFullViewingKeyMode;
          skipOpenApp?: boolean;
        },
        GetFullViewingKeyDAError,
        GetFullViewingKeyDAIntermediateValue
      >,
      {
        title: "Sign Transaction",
        description: "Sign a transaction with the device",
        executeDeviceAction: ({ derivationPath, transaction, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const txBytes = hexaStringToBuffer(transaction);
          if (!txBytes) {
            throw new Error("Invalid transaction hex string");
          }
          return signer.signTransaction(derivationPath, txBytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/133'/0'/0/0",
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
        title: "Get Trusted Input",
        description: "Call GET_TRUSTED_INPUT command on the device",
        executeDeviceAction: ({
          transaction,
          useIndexLookup,
          indexLookup,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const txBytes = hexaStringToBuffer(transaction);
          if (!txBytes) {
            throw new Error("Invalid transaction hex string");
          }

          return signer.getTrustedInput(txBytes, {
            indexLookup: useIndexLookup ? indexLookup : undefined,
            skipOpenApp,
          });
        },
        initialValues: {
          transaction: "",
          useIndexLookup: true,
          indexLookup: 0,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetTrustedInputDAOutput,
        {
          transaction: string;
          useIndexLookup: boolean;
          indexLookup: number;
          skipOpenApp?: boolean;
        },
        GetTrustedInputDAError,
        GetTrustedInputDAIntermediateValue
      >,
      {
        title: "Sign Message",
        description: "Sign a message with the device",
        executeDeviceAction: ({ derivationPath, message }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signMessage(derivationPath, message);
        },
        initialValues: {
          derivationPath: "44'/133'/0'/0/0",
          message: "Hello World",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignMessageDAOutput,
        {
          derivationPath: string;
          message: string;
        },
        SignMessageDAError,
        SignMessageDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Zcash" deviceActions={deviceActions} />
  );
};
