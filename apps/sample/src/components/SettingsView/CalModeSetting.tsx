import React, { useCallback } from "react";
import { SelectInput } from "@ledgerhq/react-ui";
import { useDispatch, useSelector } from "react-redux";

import { type CalMode } from "@/state/settings/schema";
import { selectCalMode } from "@/state/settings/selectors";
import { setCalMode } from "@/state/settings/slice";

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

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (option && (option.value === "prod" || option.value === "test")) {
        dispatch(setCalMode({ calMode: option.value as CalMode }));
      }
    },
    [dispatch],
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
