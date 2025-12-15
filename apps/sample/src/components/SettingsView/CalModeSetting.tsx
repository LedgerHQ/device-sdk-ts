import React, { useCallback } from "react";
import { SelectInput } from "@ledgerhq/react-ui";

import { useCalMode, useSetCalMode } from "@/state/settings/hooks";
import { type CalMode } from "@/state/settings/schema";

import { SettingBox } from "./SettingBox";

type Option = { label: string; value: string };

const modeOptions: Option[] = [
  { label: "Production", value: "prod" },
  { label: "Testing", value: "test" },
];

export const CalModeSetting: React.FC = () => {
  const calMode = useCalMode();
  const setCalMode = useSetCalMode();

  const selectedOption = modeOptions.find((opt) => opt.value === calMode);

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (option && (option.value === "prod" || option.value === "test")) {
        setCalMode(option.value as CalMode);
      }
    },
    [setCalMode],
  );

  return (
    <SettingBox title="CAL Mode">
      <SelectInput
        options={modeOptions}
        value={selectedOption}
        onChange={onValueChange}
        isMulti={false}
        isSearchable={false}
        placeholder="Select mode"
      />
    </SettingBox>
  );
};
