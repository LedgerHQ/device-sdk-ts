import React, { useCallback } from "react";
import { SelectInput } from "@ledgerhq/react-ui";

import { useCalBranch, useSetCalBranch } from "@/state/settings/hooks";
import { type CalBranch } from "@/state/settings/schema";

import { SettingBox } from "./SettingBox";

type Option = { label: string; value: string };

const branchOptions: Option[] = [
  { label: "Main", value: "main" },
  { label: "Next", value: "next" },
  { label: "Demo", value: "demo" },
];

export const CalBranchSetting: React.FC = () => {
  const calBranch = useCalBranch();
  const setCalBranch = useSetCalBranch();

  const selectedOption = branchOptions.find((opt) => opt.value === calBranch);

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (
        option &&
        (option.value === "main" ||
          option.value === "next" ||
          option.value === "demo")
      ) {
        setCalBranch(option.value as CalBranch);
      }
    },
    [setCalBranch],
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
