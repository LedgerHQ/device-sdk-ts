import React, { useCallback } from "react";
import { BuiltinTransports, SdkError } from "@ledgerhq/device-management-kit";
import { Button, Flex } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useSdkConfigContext } from "@/providers/SdkConfig";

type ConnectDeviceActionsProps = {
  onError: (error: SdkError | null) => void;
};

const ConnectButton = styled(Button).attrs({ mx: 3 })``;

export const ConnectDeviceActions = ({
  onError,
}: ConnectDeviceActionsProps) => {
  const {
    dispatch: dispatchSdkConfig,
    state: { transport },
  } = useSdkConfigContext();
  const { dispatch: dispatchDeviceSession } = useDeviceSessionsContext();
  const sdk = useSdk();

  const onSelectDeviceClicked = useCallback(
    (selectedTransport: BuiltinTransports) => {
      onError(null);
      dispatchSdkConfig({
        type: "set_transport",
        payload: { transport: selectedTransport },
      });
      sdk.startDiscovering({ transport: selectedTransport }).subscribe({
        next: (device) => {
          sdk
            .connect({ device })
            .then((sessionId) => {
              console.log(
                `🦖 Response from connect: ${JSON.stringify(sessionId)} 🎉`,
              );
              dispatchDeviceSession({
                type: "add_session",
                payload: {
                  sessionId,
                  connectedDevice: sdk.getConnectedDevice({ sessionId }),
                },
              });
            })
            .catch((error) => {
              onError(error);
              console.error(`Error from connection or get-version`, error);
            });
        },
        error: (error) => {
          console.error(error);
        },
      });
    },
    [sdk, transport],
  );

  return transport === BuiltinTransports.MOCK_SERVER ? (
    <ConnectButton
      onClick={() => onSelectDeviceClicked(BuiltinTransports.MOCK_SERVER)}
      variant="main"
      backgroundColor="main"
      size="large"
      data-testid="CTA_select-device"
    >
      Select a device
    </ConnectButton>
  ) : (
    <Flex>
      <ConnectButton
        onClick={() => onSelectDeviceClicked(BuiltinTransports.USB)}
        variant="main"
        backgroundColor="main"
        size="large"
      >
        Select a USB device
      </ConnectButton>
      <ConnectButton
        onClick={() => onSelectDeviceClicked(BuiltinTransports.BLE)}
        variant="main"
        backgroundColor="main"
        size="large"
      >
        Select a BLE device
      </ConnectButton>
    </Flex>
  );
};
