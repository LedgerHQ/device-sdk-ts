import React from "react";

import { SelectInput } from "@/components/fields";

import { PARSER_PRESETS } from "./presets";

type PresetSelectorProps = {
  selectedPresetId: string;
  onSelect: (presetId: string) => void;
  disabled?: boolean;
};

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  selectedPresetId,
  onSelect,
  disabled = false,
}) => {
  const options = PARSER_PRESETS.map((preset) => ({
    label: preset.name,
    value: preset.id,
  }));

  const selectedOption = options.find((opt) => opt.value === selectedPresetId);

  const handleChange = (option: { label: string; value: string } | null) => {
    if (option) {
      onSelect(option.value);
    }
  };

  return (
    <SelectInput
      label="Preset"
      options={options}
      value={selectedOption}
      onChange={handleChange}
      isDisabled={disabled}
      placeholder="Select a preset..."
    />
  );
};
