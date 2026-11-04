import React from "react";

import { Input } from "@/components/fields";

import { AddStepButton } from "./AddStepButton";
import { ParserStepInput } from "./ParserStepInput";
import { PresetSelector } from "./PresetSelector";
import { useApduResponseParser } from "./useApduResponseParser";

const Section: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col gap-16">{children}</div>
);

const SectionHeader: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="body-3-semi-bold text-muted">{children}</span>
);

const StatusCodeBox: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="rounded-sm bg-muted px-12 py-8">{children}</div>
);

export const ResponseParserModeInput: React.FC = () => {
  const parser = useApduResponseParser();

  return (
    <div className="flex flex-col gap-y-24">
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
          label="Hex"
          hint="Enter the full APDU response including status code (last 2 bytes)"
          placeholder="01 05 42 4F 4C 4F 53 09 31 2E 34 2E 30 2D 72 63 32 90 00"
          value={parser.hexInput}
          onChange={parser.setHexInput}
        />
        {parser.inputValidation.error && (
          <span className="body-4 text-error">
            {parser.inputValidation.error}
          </span>
        )}

        {parser.parsedResponse && (
          <div className="flex flex-row gap-x-12 items-center">
            <span className="body-3 text-muted">Status Code:</span>
            <StatusCodeBox>
              <span className="body-3-semi-bold font-mono">
                {parser.parsedResponse.statusCodeHex}
              </span>
            </StatusCodeBox>
            <span className="body-3 text-muted">
              Data: {parser.parsedResponse.data.length} bytes
            </span>
          </div>
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
          <span className="body-3 text-muted">
            Remaining unparsed: {parser.remainingBytes} bytes
          </span>
        )}
      </Section>
    </div>
  );
};
