import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { SelectInput } from "@/components/fields";
import { type CalBranch } from "@/state/settings/schema";
import { selectCalBranch } from "@/state/settings/selectors";
import { setCalBranch } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
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
      <div className="flex flex-1 flex-col items-stretch">
        <SelectInput
          label="Branch Reference"
          options={branchOptions}
          value={selectedOption}
          onChange={onValueChange}
          placeholder="Select branch"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectCalBranch}
        setStateAction={setCalBranchFn}
      />
    </SettingBox>
  );
};
