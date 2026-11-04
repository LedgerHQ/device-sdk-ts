import React from "react";
import { DeviceStatus } from "@ledgerhq/device-management-kit";
import { cn } from "@ledgerhq/lumen-design-core/cn";

const getColorClass = (state: DeviceStatus) => {
  switch (state) {
    case DeviceStatus.CONNECTED:
      return "text-success";
    case DeviceStatus.BUSY:
    case DeviceStatus.LOCKED:
      return "text-warning";
    case DeviceStatus.NOT_CONNECTED:
      return "text-error";
  }
};

type StatusTextProps = {
  readonly state: DeviceStatus;
} & React.ComponentProps<"span">;

export const StatusText: React.FC<StatusTextProps> = ({
  state,
  className,
  ...props
}) => (
  <span className={cn("body-3", getColorClass(state), className)} {...props} />
);
