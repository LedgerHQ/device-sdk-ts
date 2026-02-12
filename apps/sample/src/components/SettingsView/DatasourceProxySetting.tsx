import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, SelectInput } from "@ledgerhq/react-ui";

import { SelectInputLabel } from "@/components/InputLabel";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <SelectInput
          renderLeft={() => (
            <SelectInputLabel>Datasource Proxy</SelectInputLabel>
          )}
          options={proxyOptions}
          value={selectedOption}
          onChange={onValueChange}
          isMulti={false}
          isSearchable={false}
          placeholder="Select proxy"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={() => datasourceProxy || "default"}
        setStateAction={setDatasourceProxyFn}
      />
    </SettingBox>
  );
};
