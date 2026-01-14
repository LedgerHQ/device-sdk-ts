import React from "react";
import { Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { Dropdown, DropdownItem } from "@/components/Dropdown";

import { EXTRACT_METHODS } from "./extractMethods";
import { type ExtractMethod } from "./types";

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px dashed ${({ theme }) => theme.colors.neutral.c50};
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.neutral.c70};
  font-size: 14px;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary.c80};
    color: ${({ theme }) => theme.colors.primary.c80};
  }
`;

type AddStepButtonProps = {
  onAdd: (method: ExtractMethod) => void;
};

export const AddStepButton: React.FC<AddStepButtonProps> = ({ onAdd }) => {
  return (
    <Dropdown
      trigger={
        <AddButton>
          <Icons.Plus size="XS" />
          Add parsing step
        </AddButton>
      }
    >
      {Object.entries(EXTRACT_METHODS).map(([key, info]) => (
        <DropdownItem key={key} onClick={() => onAdd(key as ExtractMethod)}>
          <Text variant="small" fontWeight="medium">
            {info.label}
          </Text>
          <Text variant="extraSmall" color="neutral.c60">
            {info.description}
          </Text>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
