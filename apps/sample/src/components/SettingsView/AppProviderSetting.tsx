import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input, Text } from "@ledgerhq/react-ui";

import { selectAppProvider } from "@/state/settings/selectors";
import { setAppProvider } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const AppProviderSetting: React.FC = () => {
  const appProvider = useSelector(selectAppProvider);
  const dispatch = useDispatch();

  const onValueChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        dispatch(setAppProvider({ appProvider: parsed }));
      }
    },
    [dispatch],
  );

  return (
    <SettingBox title="App Provider">
      <Flex flexDirection="column" rowGap={2}>
        <Text variant="small">Provider ID (must be ≥ 1)</Text>
        <Input
          value={String(appProvider)}
          onChange={onValueChange}
          type="number"
          placeholder="Provider ID"
        />
      </Flex>
    </SettingBox>
  );
};
