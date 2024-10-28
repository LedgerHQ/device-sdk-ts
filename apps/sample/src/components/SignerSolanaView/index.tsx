import React, { useMemo } from "react";
import {
  GetAddressDAError,
  GetAddressDAIntermediateValue,
  GetAddressDAOutput,
  SignerSolanaBuilder,
} from "@ledgerhq/device-signer-kit-solana";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useSdk } from "@/providers/DeviceSdkProvider";

const DEFAULT_DERIVATION_PATH = "44'/501'";

export const SignerSolanaView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const sdk = useSdk();
  const signer = new SignerSolanaBuilder({ sdk, sessionId }).build();

  const deviceModelId = sdk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get address",
        description:
          "Perform all the actions necessary to get a Solana address from the device",
        executeDeviceAction: ({ derivationPath, checkOnDevice }) => {
          return signer.getAddress(derivationPath, {
            checkOnDevice,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          checkOnDevice: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Solana Signer" deviceActions={deviceActions} />
  );
};
