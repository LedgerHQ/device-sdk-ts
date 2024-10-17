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
    state: { transport },
  } = useSdkConfigContext();
  const { dispatch: dispatchDeviceSession } = useDeviceSessionsContext();
  const sdk = useSdk();

  const onSelectDeviceClicked = useCallback(
    (selectedTransport: BuiltinTransports) => {
      onError(null);
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
    [dispatchDeviceSession, onError, sdk],
  );

  // This implementation gives the impression that working with the mock server
  // is a special case, when in fact it's just a transport like the others
  // TODO: instead of toggling between mock & regular config, we should
  // just have a menu to select the active transports (where the active menu)
  // and this here should be a list of one buttons for each active transport
  // also we should not have a different appearance when the mock server is enabled
  // we should just display the list of active transports somewhere in the sidebar, discreetly

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
