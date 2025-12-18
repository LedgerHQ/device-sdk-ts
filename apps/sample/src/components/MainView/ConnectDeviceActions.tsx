import React, { useCallback } from "react";
import { useSelector } from "react-redux";
import { type DmkError } from "@ledgerhq/device-management-kit";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { speculosIdentifier } from "@ledgerhq/device-transport-kit-speculos";
import { webBleIdentifier } from "@ledgerhq/device-transport-kit-web-ble";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Button, Flex } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectTransport } from "@/state/settings/selectors";

type ConnectDeviceActionsProps = {
  onError: (error: DmkError | null) => void;
};

const ConnectButton = styled(Button).attrs({ mx: 3 })``;

export const ConnectDeviceActions = ({
  onError,
}: ConnectDeviceActionsProps) => {
  const transport = useSelector(selectTransport);
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
    [onError, dmk],
  );

  // This implementation gives the impression that working with the mock server
  // is a special case, when in fact it's just a transport like the others
  // TODO: instead of toggling between mock & regular config, we should
  // just have a menu to select the active transports (where the active menu)
  // and this here should be a list of one buttons for each active transport
  // also we should not have a different appearance when the mock server is enabled
  // we should just display the list of active transports somewhere in the sidebar, discreetly

  switch (transport) {
    case mockserverIdentifier:
    case speculosIdentifier:
      return (
        <ConnectButton
          onClick={() => onSelectDeviceClicked(transport)}
          variant="main"
          backgroundColor="main"
          size="large"
          data-testid="CTA_select-device"
        >
          Select a device
        </ConnectButton>
      );
    default:
      return (
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
  }
};
