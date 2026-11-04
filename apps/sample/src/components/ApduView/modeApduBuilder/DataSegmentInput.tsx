import React from "react";
import { Close } from "@ledgerhq/lumen-ui-react/symbols";

import { Input, SelectInput } from "@/components/fields";

import { DATA_SEGMENT_METHODS } from "./dataSegmentMethods";
import {
  type DataSegment,
  type DataSegmentMethod,
  type DataSegmentValidation,
} from "./types";

const Container: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col items-start gap-16 rounded-md bg-surface p-24">
    {children}
  </div>
);

const ValueInputContainer: React.FC<React.PropsWithChildren> = ({
  children,
}) => <div className="min-w-0 flex-1">{children}</div>;

const DeleteButton: React.FC<React.ComponentProps<"button">> = (props) => (
  <button
    className="flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-8 text-muted transition-all duration-150 hover:bg-muted-transparent-hover hover:text-error"
    {...props}
  />
);

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
    <Container>
      <span className="body-4 text-muted">
        {selectedMethodInfo.description}
      </span>
      <div className="flex flex-row items-start w-full gap-x-12">
        <SelectInput
          label="Method"
          options={methodOptions}
          value={methodOptions.find((opt) => opt.value === segment.method)}
          onChange={handleMethodChange}
          placeholder="Select method"
        />
        <ValueInputContainer>
          <Input
            label="Value"
            type={getInputType()}
            placeholder={selectedMethodInfo.placeholder}
            value={segment.value}
            onChange={(value) => onUpdate({ value })}
          />
        </ValueInputContainer>
        <DeleteButton onClick={onRemove} title="Remove segment">
          <Close size={16} />
        </DeleteButton>
      </div>
      {!validation.isValid && validation.error && (
        <span className="body-4 text-error">{validation.error}</span>
      )}
    </Container>
  );
};
