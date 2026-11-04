import React from "react";
import { Plus } from "@ledgerhq/lumen-ui-react/symbols";

import { Dropdown, DropdownItem } from "@/components/Dropdown";
import { useConnectDevice } from "@/hooks/useConnectDevice";

export const ConnectDeviceMenuDropdown: React.FC = () => {
  const { transportOptions, connectWithTransport } = useConnectDevice();

  return (
    <Dropdown
      trigger={
        <div className="group flex cursor-pointer flex-row items-center gap-8 select-none">
          <span className="body-3 text-base group-hover:underline">
            Connect device
          </span>
          <Plus size={12} className="text-base" />
        </div>
      }
    >
      {transportOptions.map((option) => (
        <DropdownItem
          key={option.identifier}
          onClick={() => connectWithTransport(option.identifier)}
        >
          <span className="body-2 text-muted">{option.label}</span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
