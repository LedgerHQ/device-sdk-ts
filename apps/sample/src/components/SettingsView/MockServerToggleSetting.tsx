import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex } from "@ledgerhq/react-ui";

import { SimpleSwitch } from "@/components/SimpleSwitch";
import { type TransportType } from "@/state/settings/schema";
import { selectTransportType } from "@/state/settings/selectors";
import { setTransportType } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const MockServerToggleSetting: React.FC = () => {
  const transportType = useSelector(selectTransportType);
  const dispatch = useDispatch();

  const mockServerEnabled = transportType === "mockserver";

  const setTransportTypeFn = useCallback(
    (value: TransportType) => {
      dispatch(setTransportType({ transportType: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(() => {
    setTransportTypeFn(mockServerEnabled ? "default" : "mockserver");
  }, [setTransportTypeFn, mockServerEnabled]);

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <SimpleSwitch
          onChange={onToggle}
          checked={mockServerEnabled}
          name="switch-mock-server"
          label="Enable Mock server"
          data-testid="switch_mock-server"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectTransportType}
        setStateAction={setTransportTypeFn}
      />
    </SettingBox>
  );
};
