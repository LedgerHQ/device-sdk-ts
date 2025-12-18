import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectAppProvider } from "@/state/settings/selectors";
import { setAppProvider } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const AppProviderSetting: React.FC = () => {
  const appProvider = useSelector(selectAppProvider);
  const dispatch = useDispatch();

  const setAppProviderFn = useCallback(
    (value: number) => {
      dispatch(setAppProvider({ appProvider: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        setAppProviderFn(parsed);
      }
    },
    [setAppProviderFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>App Provider ID (must be ≥ 1)</InputLabel>}
          value={String(appProvider)}
          onChange={onValueChange}
          type="number"
          placeholder="Provider ID"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectAppProvider}
        setStateAction={setAppProviderFn}
      />
    </SettingBox>
  );
};
