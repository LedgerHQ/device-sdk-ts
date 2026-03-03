import React, { useMemo } from "react";
import {
  type SignActionsDAError,
  type SignActionsDAIntermediateValue,
  type SignActionsDAOutput,
  SignerHyperliquidBuilder,
} from "@ledgerhq/device-signer-kit-hyperliquid";
import { type SignActionsActionItem } from "@ledgerhq/device-signer-kit-hyperliquid/api/app-binder/SignActionsDeviceActionTypes.js";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

function hexToUint8Array(hex: string): Uint8Array {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = s.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
  return new Uint8Array(bytes);
}

type SignActionsFormInput = {
  derivationPath: string;
  certificate: string;
  signedMetadata: string;
  skipOpenApp: boolean;
};

export const SignerHyperliquidView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = new SignerHyperliquidBuilder({
    dmk,
    sessionId,
  }).build();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  const deviceActions: DeviceActionProps<
    SignActionsDAOutput,
    Omit<SignActionsFormInput, "actions"> & {
      actions: string;
    },
    SignActionsDAError,
    SignActionsDAIntermediateValue
  >[] = useMemo(
    () => [
      {
        title: "Sign Actions",
        description: "Sign a Actions with the device",
        executeDeviceAction: ({
          derivationPath,
          certificate,
          signedMetadata,
          actions,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signActions({
            derivationPath,
            certificate: hexToUint8Array(certificate),
            signedMetadata: hexToUint8Array(signedMetadata),
            actions: JSON.parse(actions) as SignActionsActionItem[],
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "44'/60'/0'/0'",
          certificate:
            "0101010201023501053601011004010700001302000214010120055969656c643002001231011132012134010133210387a7ddee90538aec5a7ecaf1661f78f3fe38850a0bb55a8369ce9046b800620415473045022100a101cd3f31c8322b08082de2515d58a1e169ff589451a9785113236c414fc7090220281faf69fb957bb358fee2f29f0451535c93a88fcd426790ae72faa0a69c47bc", // hex for "1234567890"
          signedMetadata:
            "01012b02010181d0010081d10400000001240345544881d20100154730450220346b19f3cdae6aea7eb88c1afe416274f635dd494cf5a8add57856d2429a9f7d022100f4202dc04ed2ca3ab65b6518aa7dae1899191278cc7f97e28a2fd0a1aaf18d45",
          actions:
            '[{"type":"order","orders":[{"a":1,"b":true,"p":"1978.8","s":"0.5154","r":false,"t":{"limit":{"tif":"Ioc"}}}],"grouping":"na","builder":{"b":"0xc0708cdd6cd166d51da264e3f49a0422be26e35b","f":100},"nonce":1772440978177}]',
          skipOpenApp: false,
        },
        deviceModelId,
      },
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList
      title="Signer Hyperliquid"
      deviceActions={deviceActions}
    />
  );
};
