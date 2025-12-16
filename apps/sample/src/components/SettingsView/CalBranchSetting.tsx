import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, SelectInput } from "@ledgerhq/react-ui";

import { SelectInputLabel } from "@/components/InputLabel";
import { type CalBranch } from "@/state/settings/schema";
import { selectCalBranch } from "@/state/settings/selectors";
import { setCalBranch } from "@/state/settings/slice";

import { ResetSetting } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

type Option = { label: string; value: CalBranch };

const branchOptions: Option[] = [
  { label: "main", value: "main" },
  { label: "next", value: "next" },
  { label: "demo", value: "demo" },
];

export const CalBranchSetting: React.FC = () => {
  const calBranch = useSelector(selectCalBranch);
  const dispatch = useDispatch();

  const selectedOption = branchOptions.find((opt) => opt.value === calBranch);

  const setCalBranchFn = useCallback(
    (value: CalBranch) => {
      dispatch(setCalBranch({ calBranch: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (option) {
        setCalBranchFn(option.value);
      }
    },
    [setCalBranchFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <SelectInput
          renderLeft={() => (
            <SelectInputLabel>Branch Reference</SelectInputLabel>
          )}
          options={branchOptions}
          value={selectedOption}
          onChange={onValueChange}
          isMulti={false}
          isSearchable={false}
          placeholder="Select branch"
        />
      </Flex>
      <ResetSetting
        stateSelector={selectCalBranch}
        setStateAction={setCalBranchFn}
      />
    </SettingBox>
  );
};
