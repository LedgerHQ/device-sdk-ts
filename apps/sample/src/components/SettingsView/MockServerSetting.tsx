import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Flex, Input, Switch } from "@ledgerhq/react-ui";

import {
  selectMockServerUrl,
  selectTransport,
} from "@/state/settings/selectors";
import { setMockServerUrl, setTransport } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const MockServerSetting: React.FC = () => {
  const transport = useSelector(selectTransport);
  const mockServerUrl = useSelector(selectMockServerUrl);
  const dispatch = useDispatch();

  const mockServerEnabled = transport === mockserverIdentifier;

  const onToggle = useCallback(() => {
    dispatch(
      setTransport({
        transport: mockServerEnabled ? webHidIdentifier : mockserverIdentifier,
      }),
    );
  }, [dispatch, mockServerEnabled]);

  const onUrlChange = useCallback(
    (url: string) => {
      dispatch(setMockServerUrl({ mockServerUrl: url }));
    },
    [dispatch],
  );

  return (
    <SettingBox title="Mock Server">
      <Flex flexDirection="column" rowGap={3}>
        <Switch
          onChange={onToggle}
          checked={mockServerEnabled}
          name="switch-mock-server"
          label="Enable Mock server"
          data-testid="switch_mock-server"
        />
        <Input
          value={mockServerUrl}
          onChange={onUrlChange}
          placeholder="Mock server URL"
          disabled={!mockServerEnabled}
        />
      </Flex>
    </SettingBox>
  );
};
