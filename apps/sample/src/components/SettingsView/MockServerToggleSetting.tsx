import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type TransportIdentifier } from "@ledgerhq/device-management-kit";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Flex, Switch } from "@ledgerhq/react-ui";

import { selectTransport } from "@/state/settings/selectors";
import { setTransport } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const MockServerToggleSetting: React.FC = () => {
  const transport = useSelector(selectTransport);
  const dispatch = useDispatch();

  const mockServerEnabled = transport === mockserverIdentifier;

  const setTransportFn = useCallback(
    (value: TransportIdentifier) => {
      dispatch(setTransport({ transport: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(() => {
    setTransportFn(mockServerEnabled ? webHidIdentifier : mockserverIdentifier);
  }, [setTransportFn, mockServerEnabled]);

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
        stateSelector={selectTransport}
        setStateAction={setTransportFn}
      />
    </SettingBox>
  );
};
