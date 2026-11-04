import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { SelectInput } from "@/components/fields";
import { type DatasourceProxy } from "@/state/settings/schema";
import { selectDatasourceProxy } from "@/state/settings/selectors";
import { setDatasourceProxy } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

type Option = { label: string; value: string };

const proxyOptions: Option[] = [
  { label: "Default", value: "default" },
  { label: "Safe", value: "safe" },
];

export const DatasourceProxySetting: React.FC = () => {
  const datasourceProxy = useSelector(selectDatasourceProxy);
  const dispatch = useDispatch();

  const selectedOption = proxyOptions.find(
    (opt) => opt.value === datasourceProxy,
  );

  const setDatasourceProxyFn = useCallback(
    (value: DatasourceProxy) => {
      dispatch(setDatasourceProxy({ datasourceProxy: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (option) {
        setDatasourceProxyFn(option.value as DatasourceProxy);
      }
    },
    [setDatasourceProxyFn],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <SelectInput
          label="Datasource Proxy"
          options={proxyOptions}
          value={selectedOption}
          onChange={onValueChange}
          placeholder="Select proxy"
        />
      </div>
      <ResetSettingCTA
        stateSelector={() => datasourceProxy || "default"}
        setStateAction={setDatasourceProxyFn}
      />
    </SettingBox>
  );
};
