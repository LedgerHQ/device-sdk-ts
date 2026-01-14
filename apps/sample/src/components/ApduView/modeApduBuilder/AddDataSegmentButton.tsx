import React from "react";
import { Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { Dropdown, DropdownItem } from "@/components/Dropdown";

import { DATA_SEGMENT_METHODS } from "./dataSegmentMethods";
import { type DataSegmentMethod } from "./types";

const AddSegmentButton = styled.button`
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
          <Icons.Plus size="XS" />
          Add data segment
        </AddSegmentButton>
      }
    >
      {Object.entries(DATA_SEGMENT_METHODS).map(([key, info]) => (
        <DropdownItem key={key} onClick={() => onAdd(key as DataSegmentMethod)}>
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
