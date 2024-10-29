import React, { useCallback, useState } from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { AvailableDevice } from "@/components/Device";
import { useAvailableDevices } from "@/hooks/useAvailableDevices";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

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
    <>
      <Flex
        flexDirection="row"
        onClick={noDevice ? undefined : toggleUnfolded}
        alignItems="center"
        mt={1}
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
        mb={4}
      >
        {unfolded
          ? discoveredDevices.map((device) => (
              <KnownDevice key={device.id} {...device} />
            ))
          : null}
      </Flex>
    </>
  );
};

const KnownDevice: React.FC<DiscoveredDevice & { connected: boolean }> = (
  device,
) => {
  const { deviceModel, connected } = device;
  const sdk = useSdk();
  const { dispatch } = useDeviceSessionsContext();
  const connectToDevice = useCallback(() => {
    sdk.connect({ device }).then((sessionId) => {
      dispatch({
        type: "add_session",
        payload: {
          sessionId,
          connectedDevice: sdk.getConnectedDevice({ sessionId }),
        },
      });
    });
  }, [sdk, device, dispatch]);

  return (
    <Flex flexDirection="row" alignItems="center">
      <AvailableDevice
        name={deviceModel.name}
        model={deviceModel.model}
        type={"USB"}
        connected={connected}
        onConnect={connectToDevice}
      />
    </Flex>
  );
};
