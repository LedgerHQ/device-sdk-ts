import React, { useMemo } from "react";
import { MockClient } from "@ledgerhq/device-mockserver-client";

import { DeviceScreen, type DeviceScreenProps } from "./DeviceScreen";
import { mockServerScreenApi } from "./mockServerScreenApi";
import { useMockServerDevice } from "./useMockServerDevice";

export type MockServerDeviceProps = Pick<
  DeviceScreenProps,
  "floating" | "defaultCollapsed"
> & {
  url: string;
  /** Of the session owning the device: devices are scoped to their session. */
  token: string;
  deviceId: string;
};

export const MockServerDevice: React.FC<MockServerDeviceProps> = ({
  url,
  token,
  deviceId,
  ...props
}) => {
  const client = useMemo(() => new MockClient(url, { token }), [url, token]);
  const api = useMemo(
    () => mockServerScreenApi(client, deviceId),
    [client, deviceId],
  );
  const device = useMockServerDevice(client, deviceId);

  // Decides touch or buttons, so nothing renders until it is known. An
  // unreadable record still shows the screen, and its errors.
  if (device === undefined) return null;

  return (
    <DeviceScreen
      api={api}
      deviceType={device?.device_type ?? ""}
      firmwareVersion={device?.firmware_version}
      {...props}
    />
  );
};
