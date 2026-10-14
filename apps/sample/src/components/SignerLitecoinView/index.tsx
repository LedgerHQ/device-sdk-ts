import React, { useMemo } from "react";
import {
  type AddressFormat,
  type BtcLegacyErrorCodes,
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  LITECOIN_PROFILE,
  SignerBtcLegacyBuilder,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const addressFormatOptions: { label: string; value: AddressFormat }[] = [
  { label: "Legacy", value: "legacy" },
  { label: "P2SH", value: "p2sh" },
  { label: "Bech32", value: "bech32" },
];

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
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Litecoin" deviceActions={deviceActions} />
  );
};
