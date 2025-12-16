import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";
import { speculosIdentifier } from "@ledgerhq/device-transport-kit-speculos";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Flex, Switch } from "@ledgerhq/react-ui";

import { selectTransport } from "@/state/settings/selectors";
import { setTransport } from "@/state/settings/slice";

import { ResetSetting } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const SpeculosToggleSetting: React.FC = () => {
  const transport = useSelector(selectTransport);
  const dispatch = useDispatch();

  const speculosEnabled = transport === speculosIdentifier;

  const setTransportFn = useCallback(
    (value: TransportIdentifier) => {
      dispatch(setTransport({ transport: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(() => {
    setTransportFn(speculosEnabled ? webHidIdentifier : speculosIdentifier);
  }, [setTransportFn, speculosEnabled]);

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
      <ResetSetting
        stateSelector={selectTransport}
        setStateAction={setTransportFn}
      />
    </SettingBox>
  );
};
