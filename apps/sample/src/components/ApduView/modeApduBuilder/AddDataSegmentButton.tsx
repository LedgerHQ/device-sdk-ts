import React from "react";
import { Plus } from "@ledgerhq/lumen-ui-react/symbols";

import { Dropdown, DropdownItem } from "@/components/Dropdown";

import { DATA_SEGMENT_METHODS } from "./dataSegmentMethods";
import { type DataSegmentMethod } from "./types";

const AddSegmentButton: React.FC<React.ComponentProps<"button">> = (props) => (
  <button
    className="body-2 flex cursor-pointer items-center gap-8 rounded-md border border-dashed border-muted-subtle bg-transparent px-16 py-8 text-muted transition-all duration-150 hover:border-interactive hover:text-interactive"
    {...props}
  />
);

type AddDataSegmentButtonProps = {
  onAdd: (method: DataSegmentMethod) => void;
};

export const AddDataSegmentButton: React.FC<AddDataSegmentButtonProps> = ({
  onAdd,
}) => {
  return (
    <Dropdown
      trigger={
        <AddSegmentButton>
          <Plus size={16} />
          Add data segment
        </AddSegmentButton>
      }
    >
      {Object.entries(DATA_SEGMENT_METHODS).map(([key, info]) => (
        <DropdownItem key={key} onClick={() => onAdd(key as DataSegmentMethod)}>
          <span className="body-3-semi-bold text-base">{info.label}</span>
          <span className="body-4 text-muted">{info.description}</span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
