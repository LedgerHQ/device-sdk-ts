import React from "react";
import { Flex, Icons, Input, SelectInput, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";

import { ENCODE_METHODS, EXTRACT_METHODS } from "./extractMethods";
import {
  type EncodeMethod,
  type ExtractMethod,
  type ParserStep,
  type ParserStepResult,
} from "./types";

const Container = styled(Flex)`
  flex-direction: column;
  align-items: flex-start;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.neutral.c70};

  &:hover {
    background-color: ${({ theme }) => theme.colors.neutral.c30};
    color: ${({ theme }) => theme.colors.error.c80};
  }
`;

const ResultBox = styled(Flex)`
  background-color: ${({ theme }) => theme.colors.neutral.c30};
  border-radius: 4px;
  padding: 8px 12px;
  min-height: 36px;
  word-break: break-all;
  align-self: stretch;
`;

const extractMethodOptions = Object.entries(EXTRACT_METHODS).map(
  ([key, info]) => ({
    label: info.label,
    value: key,
  }),
);

const encodeMethodOptions = Object.entries(ENCODE_METHODS).map(
  ([key, info]) => ({
    label: info.label,
    value: key,
  }),
);

type ParserStepInputProps = {
  step: ParserStep;
  result: ParserStepResult | undefined;
  onUpdate: (updates: Partial<Omit<ParserStep, "id">>) => void;
  onRemove: () => void;
};

export const ParserStepInput: React.FC<ParserStepInputProps> = ({
  step,
  result,
  onUpdate,
  onRemove,
}) => {
  const selectedMethodInfo = EXTRACT_METHODS[step.extractMethod];

  const handleMethodChange = (
    option: { label: string; value: string } | null,
  ) => {
    if (option) {
      onUpdate({ extractMethod: option.value as ExtractMethod });
    }
  };

  const handleEncodeChange = (
    option: { label: string; value: string } | null,
  ) => {
    if (option) {
      onUpdate({ encodeMethod: option.value as EncodeMethod });
    }
  };

  return (
    <Container p={4} rowGap={3}>
      <Flex
        flexDirection="row"
        columnGap={3}
        rowGap={3}
        width="100%"
        flexWrap="wrap"
      >
        <Input
          tabIndex={0}
          name="label"
          renderLeft={() => <InputLabel>Label</InputLabel>}
          placeholder="e.g. App Name"
          value={step.label}
          onChange={(value) => onUpdate({ label: value })}
        />

        <SelectInput
          isMulti={false}
          isSearchable={false}
          options={extractMethodOptions}
          value={extractMethodOptions.find(
            (opt) => opt.value === step.extractMethod,
          )}
          onChange={handleMethodChange}
          renderLeft={() => <SelectInputLabel>Extract</SelectInputLabel>}
        />

        {selectedMethodInfo.hasLengthParam && (
          <Input
            tabIndex={0}
            name="length"
            type="number"
            renderLeft={() => <InputLabel>Len</InputLabel>}
            placeholder="0"
            value={step.length?.toString() ?? ""}
            onChange={(value) => onUpdate({ length: parseInt(value, 10) || 0 })}
          />
        )}

        <SelectInput
          isMulti={false}
          isSearchable={false}
          options={encodeMethodOptions}
          value={encodeMethodOptions.find(
            (opt) => opt.value === step.encodeMethod,
          )}
          onChange={handleEncodeChange}
          renderLeft={() => <SelectInputLabel>Encode</SelectInputLabel>}
        />

        <Flex flex={1} />

        <RemoveButton onClick={onRemove} title="Remove step">
          <Icons.Close size="XS" />
        </RemoveButton>
      </Flex>

      <Text variant="extraSmall" color="neutral.c60">
        {selectedMethodInfo.description}
      </Text>

      <ResultBox>
        {result?.error ? (
          <Text variant="small" color="warning.c80">
            {result.error}
          </Text>
        ) : result?.encodedValue !== undefined ? (
          <Text variant="small" color="success.c80" fontFamily="monospace">
            {result.encodedValue}
          </Text>
        ) : (
          <Text variant="small" color="neutral.c60">
            —
          </Text>
        )}
      </ResultBox>
    </Container>
  );
};
