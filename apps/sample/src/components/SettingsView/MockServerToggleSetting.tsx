import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Switch } from "@ledgerhq/react-ui";

import { selectMockServerEnabled } from "@/state/settings/selectors";
import { setMockServerEnabled } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const MockServerToggleSetting: React.FC = () => {
  const mockServerEnabled = useSelector(selectMockServerEnabled);
  const dispatch = useDispatch();

  const setMockServerEnabledFn = useCallback(
    (value: boolean) => {
      dispatch(setMockServerEnabled({ mockServerEnabled: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(() => {
    setMockServerEnabledFn(!mockServerEnabled);
  }, [setMockServerEnabledFn, mockServerEnabled]);

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Switch
          onChange={onToggle}
          checked={mockServerEnabled}
          name="switch-mock-server"
          label="Enable Mock server"
          data-testid="switch_mock-server"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectMockServerEnabled}
        setStateAction={setMockServerEnabledFn}
      />
    </SettingBox>
  );
};
