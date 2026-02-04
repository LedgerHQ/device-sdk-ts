import React, { useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import {
  type ConnectionType,
  type DiscoveredDevice,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import { webBleIdentifier } from "@ledgerhq/device-transport-kit-web-ble";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { AvailableDevice } from "@/components/Device";
import { useAvailableDevices } from "@/hooks/useAvailableDevices";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { setDisplayedError } from "@/state/ui/slice";

const Title = styled(Text)<{ disabled: boolean }>`
  :hover {
    user-select: none;
    text-decoration: ${(p) => (p.disabled ? "none" : "underline")};
    cursor: ${(p) => (p.disabled ? "default" : "pointer")};
  }
`;

export const AvailableDevices: React.FC<Record<never, unknown>> = () => {
  const discoveredDevices = useAvailableDevices();
  const noDevice = discoveredDevices.length === 0;

  const [unfolded, setUnfolded] = useState(false);

  const toggleUnfolded = useCallback(() => {
    setUnfolded((prev) => !prev);
  }, []);

  return (
    <Flex flexDirection="column">
      <Flex
        flexDirection="row"
        onClick={noDevice ? undefined : toggleUnfolded}
        alignItems="center"
      >
        <Title variant="tiny" disabled={noDevice}>
          Available devices ({discoveredDevices.length})
        </Title>
        <Flex style={{ visibility: noDevice ? "hidden" : "visible" }}>
          {unfolded ? (
            <Icons.ChevronUp size={"XS"} />
          ) : (
            <Icons.ChevronDown size={"XS"} />
          )}
        </Flex>
      </Flex>
      <Flex
        flexDirection="column"
        rowGap={4}
        alignSelf="stretch"
        mt={unfolded ? 5 : 0}
      >
        {unfolded
          ? discoveredDevices.map((device) => (
              <KnownDevice key={device.id} {...device} />
            ))
          : null}
      </Flex>
    </Flex>
  );
};

const mapTransportToType = (transport: TransportIdentifier): ConnectionType => {
  switch (transport) {
    case webBleIdentifier:
      return "BLE";
    case webHidIdentifier:
      return "USB";
    default:
      return "MOCK";
  }
};

const KnownDevice: React.FC<DiscoveredDevice & { connected: boolean }> = (
  device,
) => {
  const { deviceModel, connected, name } = device;
  const dispatch = useDispatch();

  const dmk = useDmk();
  const connectToDevice = useCallback(async () => {
    await dmk.connect({ device }).catch((error) => {
      dispatch(setDisplayedError(error));
    });
  }, [dmk, device, dispatch]);

  return (
    <Flex flexDirection="row" alignItems="center" minWidth={0} flex={1}>
      <AvailableDevice
        name={name ?? deviceModel.name}
        model={deviceModel.model}
        type={mapTransportToType(device.transport)}
        connected={connected}
        onConnect={connectToDevice}
      />
    </Flex>
  );
};
