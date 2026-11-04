import React from "react";
import { Plus } from "@ledgerhq/lumen-ui-react/symbols";

import { Dropdown, DropdownItem } from "@/components/Dropdown";

import { EXTRACT_METHODS } from "./extractMethods";
import { type ExtractMethod } from "./types";

const AddButton: React.FC<React.ComponentProps<"button">> = (props) => (
  <button
    className="body-2 flex cursor-pointer items-center gap-8 rounded-md border border-dashed border-muted-subtle bg-transparent px-16 py-8 text-muted transition-all duration-150 hover:border-interactive hover:text-interactive"
    {...props}
  />
);

type AddStepButtonProps = {
  onAdd: (method: ExtractMethod) => void;
};

export const AddStepButton: React.FC<AddStepButtonProps> = ({ onAdd }) => {
  return (
    <Dropdown
      trigger={
        <AddButton>
          <Plus size={16} />
          Add parsing step
        </AddButton>
      }
    >
      {Object.entries(EXTRACT_METHODS).map(([key, info]) => (
        <DropdownItem key={key} onClick={() => onAdd(key as ExtractMethod)}>
          <span className="body-3-semi-bold text-base">{info.label}</span>
          <span className="body-4 text-muted">{info.description}</span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
