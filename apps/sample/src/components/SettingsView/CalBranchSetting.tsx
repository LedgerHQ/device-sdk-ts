import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { SelectInput } from "@ledgerhq/react-ui";

import { type CalBranch } from "@/state/settings/schema";
import { selectCalBranch } from "@/state/settings/selectors";
import { setCalBranch } from "@/state/settings/slice";

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

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (option) {
        dispatch(setCalBranch({ calBranch: option.value }));
      }
    },
    [dispatch],
  );

  return (
    <SettingBox title="Branch Reference">
      <SelectInput
        options={branchOptions}
        value={selectedOption}
        onChange={onValueChange}
        isMulti={false}
        isSearchable={false}
        placeholder="Select branch"
      />
    </SettingBox>
  );
};
