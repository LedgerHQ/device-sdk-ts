import { Button, Flex } from "@ledgerhq/react-ui";
import { BuiltinTransports, SdkError } from "@ledgerhq/device-management-kit";
import React, { useCallback } from "react";
import { useSdkConfigContext } from "@/providers/SdkConfig";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type ConnectDeviceActionsProps = {
  onError: (error: SdkError | null) => void;
};

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
    <Button
      mx={3}
      onClick={() => onSelectDeviceClicked(BuiltinTransports.MOCK_SERVER)}
      variant="main"
      backgroundColor="main"
      size="large"
      data-testid="CTA_select-device"
    >
      Select a device
    </Button>
  ) : (
    <Flex>
      <Button
        mx={3}
        onClick={() => onSelectDeviceClicked(BuiltinTransports.USB)}
        variant="main"
        backgroundColor="main"
        size="large"
      >
        Select a USB device
      </Button>
      <Button
        mx={3}
        onClick={() => onSelectDeviceClicked(BuiltinTransports.BLE)}
        variant="main"
        backgroundColor="main"
        size="large"
      >
        Select a BLE device
      </Button>
    </Flex>
  );
};
