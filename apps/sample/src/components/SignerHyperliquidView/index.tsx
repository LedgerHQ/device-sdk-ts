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
          certificate,
          signedMetadata,
          actions,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signActions({
            certificate: hexToUint8Array(certificate),
            signedMetadata: hexToUint8Array(signedMetadata),
            actions: JSON.parse(actions) as SignActionsActionItem[],
            skipOpenApp,
          });
        },
        initialValues: {
          certificate: "31323334353637383930", // hex for "1234567890"
          signedMetadata: "0x1234567890",
          actions:
            '{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}',
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
