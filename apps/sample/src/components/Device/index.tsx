import React, { useCallback } from "react";
import { useSelector } from "react-redux";
import {
  type ConnectionType,
  DeviceModelId,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import { Button } from "@ledgerhq/lumen-ui-react";
import {
  Flex,
  MoreHorizontal,
  Nano,
  Stax,
} from "@ledgerhq/lumen-ui-react/symbols";

import { Dropdown, DropdownItem } from "@/components/Dropdown";
import { useDeviceSessionState } from "@/hooks/useDeviceSessionState";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

import { StatusText } from "./StatusText";

// These props are subject to change.
type DeviceProps = {
  name: string;
  type: ConnectionType;
  sessionId: DeviceSessionId;
  model: DeviceModelId;
  onDisconnect: (sessionId: DeviceSessionId) => void;
  onReconnect: (sessionId: DeviceSessionId) => void;
  onSelect: (sessionId: DeviceSessionId) => void;
};

// Lumen has no Apex icon, so that model falls back to the Flex one.
function getIconComponent(model: DeviceModelId): React.FC<{ size: 24 }> {
  switch (model) {
    case DeviceModelId.STAX:
      return Stax;
    case DeviceModelId.FLEX:
      return Flex;
    case DeviceModelId.APEX:
      return Flex;
    default:
      return Nano;
  }
}

const DeviceCard: React.FC<
  React.ComponentProps<"div"> & { active: boolean }
> = ({ active, className, ...props }) => (
  <div
    className={cn(
      "flex flex-row items-center rounded-md border bg-muted p-12",
      active ? "border-success" : "border-transparent",
      !active && "cursor-pointer",
      className,
    )}
    {...props}
  />
);

const IconContainer: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="mr-8 flex shrink-0 items-center justify-center rounded-full bg-muted-transparent p-12">
    {children}
  </div>
);

export const Device: React.FC<DeviceProps> = ({
  name,
  type,
  model,
  onDisconnect,
  onReconnect,
  onSelect,
  sessionId,
}) => {
  const sessionState = useDeviceSessionState(sessionId);
  const selectedSessionId = useSelector(selectSelectedSessionId);
  const IconComponent = getIconComponent(model);
  const isActive = selectedSessionId === sessionId;

  const handleSelect = useCallback(() => {
    onSelect(sessionId);
  }, [onSelect, sessionId]);

  const handleDisconnect = useCallback(() => {
    onDisconnect(sessionId);
  }, [onDisconnect, sessionId]);

  const handleReconnect = useCallback(() => {
    onReconnect(sessionId);
  }, [onReconnect, sessionId]);

  return (
    <DeviceCard active={isActive} onClick={isActive ? undefined : handleSelect}>
      <IconContainer>
        <IconComponent size={24} />
      </IconContainer>
      <div className="min-w-0 flex-1">
        <div
          data-testid="text_device-name"
          className="body-2 truncate text-base"
        >
          {name}
        </div>
        <div className="flex">
          {sessionState && (
            <>
              <StatusText
                data-testid="text_device-connection-status"
                state={sessionState.deviceStatus}
              >
                {sessionState.deviceStatus}
              </StatusText>
              <span className="mx-8 text-muted">•</span>
            </>
          )}
          <span className="body-3 text-muted">{type}</span>
        </div>
      </div>
      <div data-testid="dropdown_device-option" className="shrink-0">
        <Dropdown trigger={<MoreHorizontal size={24} className="text-base" />}>
          <DropdownItem
            data-testid="CTA_disconnect-device"
            onClick={handleDisconnect}
          >
            <span className="body-2 text-muted">Disconnect</span>
          </DropdownItem>
          <DropdownItem
            data-testid="CTA_reconnect-device"
            onClick={handleReconnect}
          >
            <span className="body-2 text-muted">Reconnect</span>
          </DropdownItem>
        </Dropdown>
      </div>
    </DeviceCard>
  );
};

type AvailableDeviceProps = {
  model: DeviceModelId;
  name: string;
  type: ConnectionType;
  connected: boolean;
  onConnect: () => void;
};

export const AvailableDevice: React.FC<AvailableDeviceProps> = ({
  model,
  name,
  type,
  onConnect,
  connected,
}) => {
  const IconComponent = getIconComponent(model);
  return (
    <DeviceCard
      active={false}
      className="min-w-0 flex-1 flex-col items-stretch gap-12 overflow-hidden"
    >
      <div className="flex min-w-0 flex-row items-center">
        <IconContainer>
          <IconComponent size={24} />
        </IconContainer>
        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <span className="body-2 truncate text-base">{name}</span>
          <span className="body-2 text-muted">{type}</span>
        </div>
      </div>
      <Button
        appearance="gray"
        size="sm"
        isFull
        disabled={connected}
        onClick={onConnect}
      >
        Connect
      </Button>
    </DeviceCard>
  );
};
