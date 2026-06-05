import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Switch } from "@ledgerhq/react-ui";

import { selectSpeculosEnabled } from "@/state/settings/selectors";
import { setSpeculosEnabled } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const SpeculosToggleSetting: React.FC = () => {
  const speculosEnabled = useSelector(selectSpeculosEnabled);
  const dispatch = useDispatch();

  const setSpeculosEnabledFn = useCallback(
    (value: boolean) => {
      dispatch(setSpeculosEnabled({ speculosEnabled: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(() => {
    setSpeculosEnabledFn(!speculosEnabled);
  }, [setSpeculosEnabledFn, speculosEnabled]);

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Switch
          onChange={onToggle}
          checked={speculosEnabled}
          name="switch-speculos"
          label="Enable Speculos"
          data-testid="switch_speculos"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectSpeculosEnabled}
        setStateAction={setSpeculosEnabledFn}
      />
    </SettingBox>
  );
};
