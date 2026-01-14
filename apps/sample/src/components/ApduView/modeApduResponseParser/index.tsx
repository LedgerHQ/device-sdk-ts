import React from "react";
import { Flex, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { InputLabelWithTooltip } from "@/components/InputLabel";

import { AddStepButton } from "./AddStepButton";
import { ParserStepInput } from "./ParserStepInput";
import { PresetSelector } from "./PresetSelector";
import { useApduResponseParser } from "./useApduResponseParser";

const Section = styled(Flex).attrs({
  flexDirection: "column",
  rowGap: 4,
})``;

const SectionHeader = styled(Text).attrs({
  variant: "small",
  fontWeight: "medium",
  color: "neutral.c80",
})``;

const StatusCodeBox = styled(Flex)`
  background-color: ${({ theme }) => theme.colors.neutral.c30};
  border-radius: 4px;
  padding: 8px 12px;
`;

export const ResponseParserModeInput: React.FC = () => {
  const parser = useApduResponseParser();

  return (
    <Flex flexDirection="column" rowGap={8}>
      {/* Preset selector */}
      <PresetSelector
        selectedPresetId={parser.selectedPresetId}
        onSelect={parser.applyPreset}
      />

      {/* Input section */}
      <Section>
        <SectionHeader>APDU Response</SectionHeader>
        <Input
          tabIndex={0}
          name="hexInput"
          renderLeft={() => (
            <InputLabelWithTooltip hint="Enter the full APDU response including status code (last 2 bytes)">
              Hex
            </InputLabelWithTooltip>
          )}
          placeholder="01 05 42 4F 4C 4F 53 09 31 2E 34 2E 30 2D 72 63 32 90 00"
          value={parser.hexInput}
          onChange={parser.setHexInput}
        />
        {parser.inputValidation.error && (
          <Text variant="extraSmall" color="error.c80">
            {parser.inputValidation.error}
          </Text>
        )}

        {parser.parsedResponse && (
          <Flex flexDirection="row" columnGap={4} alignItems="center">
            <Text variant="small" color="neutral.c70">
              Status Code:
            </Text>
            <StatusCodeBox>
              <Text variant="small" fontWeight="bold" fontFamily="monospace">
                {parser.parsedResponse.statusCodeHex}
              </Text>
            </StatusCodeBox>
            <Text variant="small" color="neutral.c70">
              Data: {parser.parsedResponse.data.length} bytes
            </Text>
          </Flex>
        )}
      </Section>

      {/* Parsing steps section */}
      <Section>
        <SectionHeader>Parsing Steps</SectionHeader>

        {parser.steps.map((step) => {
          const result = parser.parseResults.find((r) => r.id === step.id);
          return (
            <ParserStepInput
              key={step.id}
              step={step}
              result={result}
              onUpdate={(updates) => parser.updateStep(step.id, updates)}
              onRemove={() => parser.removeStep(step.id)}
            />
          );
        })}

        <AddStepButton onAdd={parser.addStep} />

        {parser.remainingBytes !== null && parser.steps.length > 0 && (
          <Text variant="small" color="neutral.c70">
            Remaining unparsed: {parser.remainingBytes} bytes
          </Text>
        )}
      </Section>
    </Flex>
  );
};
