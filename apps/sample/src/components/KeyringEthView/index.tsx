import { Grid } from "@ledgerhq/react-ui";
import React, { useMemo } from "react";

import { useSdk } from "@/providers/DeviceSdkProvider";
import {
  GetAddressDAError,
  GetAddressDAIntermediateValue,
  GetAddressDAOutput,
  KeyringEthBuilder,
} from "@ledgerhq/keyring-eth";
import {
  DeviceAction,
  DeviceActionProps,
} from "@/components/DeviceActionsView/DeviceAction";
import { PageWithHeader } from "@/components/PageWithHeader";

export const KeyringEthView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const sdk = useSdk();
  const keyring = new KeyringEthBuilder({ sdk, sessionId }).build();

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
    ],
    [],
  );

  return (
    <PageWithHeader title="Device Actions">
      <Grid columns={1} rowGap={6} overflowY="scroll">
        {deviceActions.map((deviceAction) => (
          <DeviceAction
            key={`${deviceAction.title}_${deviceAction.description}`}
            {...deviceAction}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
