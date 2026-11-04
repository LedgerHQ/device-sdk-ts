import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { SelectInput } from "@/components/fields";
import { type CalMode } from "@/state/settings/schema";
import { selectCalMode } from "@/state/settings/selectors";
import { setCalMode } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

type Option = { label: string; value: string };

const modeOptions: Option[] = [
  { label: "Production", value: "prod" },
  { label: "Testing", value: "test" },
];

export const CalModeSetting: React.FC = () => {
  const calMode = useSelector(selectCalMode);
  const dispatch = useDispatch();

  const selectedOption = modeOptions.find((opt) => opt.value === calMode);

  const setCalModeFn = useCallback(
    (value: CalMode) => {
      dispatch(setCalMode({ calMode: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (option) {
        setCalModeFn(option.value as CalMode);
      }
    },
    [setCalModeFn],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <SelectInput
          label="CAL Mode"
          options={modeOptions}
          value={selectedOption}
          onChange={onValueChange}
          placeholder="Select mode"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectCalMode}
        setStateAction={setCalModeFn}
      />
    </SettingBox>
  );
};
