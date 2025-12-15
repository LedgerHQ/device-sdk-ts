import React, { useCallback } from "react";
import { Flex, Input, Text } from "@ledgerhq/react-ui";

import { useAppProvider, useSetAppProvider } from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const AppProviderSetting: React.FC = () => {
  const appProvider = useAppProvider();
  const setAppProvider = useSetAppProvider();

  const onValueChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        setAppProvider(parsed);
      }
    },
    [setAppProvider],
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
