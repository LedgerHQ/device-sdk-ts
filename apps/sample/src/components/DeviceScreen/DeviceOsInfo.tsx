/**
 * src/components/DeviceScreen/DeviceOsInfo.tsx
 *
 * Shown in place of the screen while the device runs no app: there is no
 * Speculos instance to capture, so the mock server's record of the device
 * stands in.
 */
"use client";

import React from "react";
import { type Device } from "@ledgerhq/device-mockserver-client";
import { Flex, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

const Row = styled(Flex)`
  justify-content: space-between;
  column-gap: 8px;
`;

const Value = styled(Text).attrs({ variant: "tiny" })`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
  text-align: right;
  word-break: break-word;
`;

export const DeviceOsInfo: React.FC<{ device: Device }> = ({ device }) => {
  const apps = device.apps ?? [];
  const rows: [string, string][] = [
    ["Model", device.device_type],
    ["Firmware", device.firmware_version ?? "—"],
    ["Connectivity", device.connectivity_type],
    [`Apps (${apps.length})`, apps.map((app) => app.name).join(", ") || "—"],
  ];

  return (
    <Flex
      flexDirection="column"
      rowGap="4px"
      data-testid="container_device-os-info"
    >
      {rows.map(([label, value]) => (
        <Row key={label}>
          <Text variant="tiny" color="neutral.c60">
            {label}
          </Text>
          <Value>{value}</Value>
        </Row>
      ))}
    </Flex>
  );
};
