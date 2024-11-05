import React, { useCallback } from "react";
import {
  BuiltinTransports,
  type DmkError,
} from "@ledgerhq/device-management-kit";
import { webBleIdentifier } from "@ledgerhq/device-transport-kit-web-ble";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Button, Flex } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useDmkConfigContext } from "@/providers/DmkConfig";

type ConnectDeviceActionsProps = {
  onError: (error: DmkError | null) => void;
};

const ConnectButton = styled(Button).attrs({ mx: 3 })``;

export const ConnectDeviceActions = ({
  onError,
}: ConnectDeviceActionsProps) => {
  const {
    state: { transport },
  } = useDmkConfigContext();
  const { dispatch: dispatchDeviceSession } = useDeviceSessionsContext();
  const dmk = useDmk();

  const onSelectDeviceClicked = useCallback(
    (selectedTransport: string) => {
      onError(null);
      dmk.startDiscovering({ transport: selectedTransport }).subscribe({
        next: (device) => {
          dmk
            .connect({ device })
            .then((sessionId) => {
              console.log(
                `🦖 Response from connect: ${JSON.stringify(sessionId)} 🎉`,
              );
              dispatchDeviceSession({
                type: "add_session",
                payload: {
                  sessionId,
                  connectedDevice: dmk.getConnectedDevice({ sessionId }),
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
    [dispatchDeviceSession, onError, dmk],
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
        onClick={() => onSelectDeviceClicked(webHidIdentifier)}
        variant="main"
        backgroundColor="main"
        size="large"
      >
        Select a USB device
      </ConnectButton>
      <ConnectButton
        onClick={() => onSelectDeviceClicked(webBleIdentifier)}
        variant="main"
        backgroundColor="main"
        size="large"
      >
        Select a BLE device
      </ConnectButton>
    </Flex>
  );
};
