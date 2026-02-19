import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex } from "@ledgerhq/react-ui";

import { SimpleSwitch } from "@/components/SimpleSwitch";
import { type TransportType } from "@/state/settings/schema";
import { selectTransportType } from "@/state/settings/selectors";
import { setTransportType } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const SpeculosToggleSetting: React.FC = () => {
  const transportType = useSelector(selectTransportType);
  const dispatch = useDispatch();

  const speculosEnabled = transportType === "speculos";

  const setTransportTypeFn = useCallback(
    (value: TransportType) => {
      dispatch(setTransportType({ transportType: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(() => {
    setTransportTypeFn(speculosEnabled ? "default" : "speculos");
  }, [setTransportTypeFn, speculosEnabled]);

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <SimpleSwitch
          onChange={onToggle}
          checked={speculosEnabled}
          name="switch-speculos"
          label="Enable Speculos"
          data-testid="switch_speculos"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectTransportType}
        setStateAction={setTransportTypeFn}
      />
    </SettingBox>
  );
};
