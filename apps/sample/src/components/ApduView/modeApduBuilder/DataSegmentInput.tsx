import React from "react";
import { Flex, Icons, Input, SelectInput, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";

import { DATA_SEGMENT_METHODS } from "./dataSegmentMethods";
import {
  type DataSegment,
  type DataSegmentMethod,
  type DataSegmentValidation,
} from "./types";

const Container = styled(Flex)`
  flex-direction: column;
  align-items: flex-start;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
`;

const ValueInputContainer = styled.div`
  flex: 1;
  min-width: 0;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.neutral.c70};
  transition: all 0.15s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.neutral.c30};
    color: ${({ theme }) => theme.colors.error.c80};
  }
`;

type DataSegmentInputProps = {
  segment: DataSegment;
  validation: DataSegmentValidation;
  onUpdate: (updates: Partial<Omit<DataSegment, "id">>) => void;
  onRemove: () => void;
};

const methodOptions = Object.entries(DATA_SEGMENT_METHODS).map(
  ([key, info]) => ({
    label: info.label,
    value: key,
  }),
);

export const DataSegmentInput: React.FC<DataSegmentInputProps> = ({
  segment,
  validation,
  onUpdate,
  onRemove,
}) => {
  const selectedMethodInfo = DATA_SEGMENT_METHODS[segment.method];

  const handleMethodChange = (
    option: { label: string; value: string } | null,
  ) => {
    if (option) {
      onUpdate({ method: option.value as DataSegmentMethod, value: "" });
    }
  };

  const getInputType = () => {
    switch (selectedMethodInfo.inputType) {
      case "number":
        return "number";
      default:
        return "text";
    }
  };

  return (
    <Container p={6} rowGap={4}>
      <Text variant="extraSmall" color="neutral.c60">
        {selectedMethodInfo.description}
      </Text>
      <Flex
        flexDirection="row"
        alignItems="flex-start"
        width="100%"
        columnGap={4}
      >
        <SelectInput
          renderLeft={() => <SelectInputLabel>Method</SelectInputLabel>}
          options={methodOptions}
          value={methodOptions.find((opt) => opt.value === segment.method)}
          onChange={handleMethodChange}
          isMulti={false}
          isSearchable={false}
          placeholder="Select method"
        />
        <ValueInputContainer>
          <Input
            renderLeft={() => <InputLabel>Value</InputLabel>}
            type={getInputType()}
            placeholder={selectedMethodInfo.placeholder}
            value={segment.value}
            onChange={(value) => onUpdate({ value })}
          />
        </ValueInputContainer>
        <DeleteButton onClick={onRemove} title="Remove segment">
          <Icons.Close size="S" />
        </DeleteButton>
      </Flex>
      {!validation.isValid && validation.error && (
        <Text variant="extraSmall" color="error.c80">
          {validation.error}
        </Text>
      )}
    </Container>
  );
};
