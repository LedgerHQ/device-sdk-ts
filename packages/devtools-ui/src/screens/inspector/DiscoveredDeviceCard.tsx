import React from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardHeaderLeft,
  CardTitle,
  SmallText,
} from "./styles";

type DiscoveredDeviceCardProps = {
  device: DiscoveredDevice;
  onConnect: () => void;
};

export const DiscoveredDeviceCard: React.FC<DiscoveredDeviceCardProps> = ({
  device,
  onConnect,
}) => {
  return (
    <Card $variant="discovered">
      <CardHeader>
        <CardHeaderLeft>
          <CardTitle>{device.name || "Unknown Device"}</CardTitle>
        </CardHeaderLeft>
        <Button $variant="success" onClick={onConnect}>
          Connect
        </Button>
      </CardHeader>

      <CardBody>
        <SmallText>ID: {device.id}</SmallText>
        <SmallText>Model: {device.deviceModel.model}</SmallText>
        <SmallText>Transport: {device.transport}</SmallText>
        {device.rssi !== undefined && device.rssi !== null && (
          <SmallText>Signal: {device.rssi} dBm</SmallText>
        )}
      </CardBody>
    </Card>
  );
};
