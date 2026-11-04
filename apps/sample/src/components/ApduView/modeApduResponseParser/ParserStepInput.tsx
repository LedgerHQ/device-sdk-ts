import React from "react";
import { Close } from "@ledgerhq/lumen-ui-react/symbols";

import { Input, SelectInput } from "@/components/fields";

import { ENCODE_METHODS, EXTRACT_METHODS } from "./extractMethods";
import {
  type EncodeMethod,
  type ExtractMethod,
  type ParserStep,
  type ParserStepResult,
} from "./types";

const Container: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col items-start gap-12 rounded-md bg-surface p-16">
    {children}
  </div>
);

const RemoveButton: React.FC<React.ComponentProps<"button">> = (props) => (
  <button
    className="flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-4 text-muted hover:bg-muted-transparent-hover hover:text-error"
    {...props}
  />
);

const ResultBox: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="min-h-36 self-stretch rounded-sm bg-muted px-12 py-8 break-all">
    {children}
  </div>
);

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
    <Container>
      <div className="flex flex-row gap-x-8 gap-y-8 w-full flex-wrap">
        <Input
          tabIndex={0}
          name="label"
          label="Label"
          placeholder="e.g. App Name"
          value={step.label}
          onChange={(value) => onUpdate({ label: value })}
        />

        <SelectInput
          options={extractMethodOptions}
          value={extractMethodOptions.find(
            (opt) => opt.value === step.extractMethod,
          )}
          onChange={handleMethodChange}
          label="Extract"
        />

        {selectedMethodInfo.hasLengthParam && (
          <Input
            tabIndex={0}
            name="length"
            type="number"
            label="Len"
            placeholder="0"
            value={step.length?.toString() ?? ""}
            onChange={(value) => onUpdate({ length: parseInt(value, 10) || 0 })}
          />
        )}

        <SelectInput
          options={encodeMethodOptions}
          value={encodeMethodOptions.find(
            (opt) => opt.value === step.encodeMethod,
          )}
          onChange={handleEncodeChange}
          label="Encode"
        />

        <div className="flex flex-1" />

        <RemoveButton onClick={onRemove} title="Remove step">
          <Close size={12} />
        </RemoveButton>
      </div>

      <span className="body-4 text-muted">
        {selectedMethodInfo.description}
      </span>

      <ResultBox>
        {result?.error ? (
          <span className="body-3 text-warning">{result.error}</span>
        ) : result?.encodedValue !== undefined ? (
          <span className="body-3 text-success font-mono">
            {result.encodedValue}
          </span>
        ) : (
          <span className="body-3 text-muted">—</span>
        )}
      </ResultBox>
    </Container>
  );
};
