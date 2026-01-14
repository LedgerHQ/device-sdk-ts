import React from "react";
import { SelectInput } from "@ledgerhq/react-ui";

import { SelectInputLabel } from "@/components/InputLabel";

import { APDU_PRESETS } from "./presets";

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
  const options = APDU_PRESETS.map((preset) => ({
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
      renderLeft={() => <SelectInputLabel>Preset</SelectInputLabel>}
      options={options}
      value={selectedOption}
      onChange={handleChange}
      isMulti={false}
      isDisabled={disabled}
      isSearchable={false}
      placeholder="Select a preset..."
    />
  );
};
