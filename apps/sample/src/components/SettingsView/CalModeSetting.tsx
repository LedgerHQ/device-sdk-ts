import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, SelectInput } from "@ledgerhq/react-ui";

import { SelectInputLabel } from "@/components/InputLabel";
import { type CalMode } from "@/state/settings/schema";
import { selectCalMode } from "@/state/settings/selectors";
import { setCalMode } from "@/state/settings/slice";

import { ResetSetting } from "./ResetSetting";
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
      if (option && (option.value === "prod" || option.value === "test")) {
        setCalModeFn(option.value as CalMode);
      }
    },
    [setCalModeFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <SelectInput
          renderLeft={() => <SelectInputLabel>CAL Mode</SelectInputLabel>}
          options={modeOptions}
          value={selectedOption}
          onChange={onValueChange}
          isMulti={false}
          isSearchable={false}
          placeholder="Select mode"
        />
      </Flex>
      <ResetSetting
        stateSelector={selectCalMode}
        setStateAction={setCalModeFn}
      />
    </SettingBox>
  );
};
