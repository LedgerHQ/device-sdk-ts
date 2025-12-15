import React, { useCallback } from "react";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Flex, Input, Switch } from "@ledgerhq/react-ui";

import {
  useMockServerUrl,
  useSetMockServerUrl,
  useSetTransport,
  useTransport,
} from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const MockServerSetting: React.FC = () => {
  const transport = useTransport();
  const mockServerUrl = useMockServerUrl();
  const setTransport = useSetTransport();
  const setMockServerUrl = useSetMockServerUrl();

  const mockServerEnabled = transport === mockserverIdentifier;

  const onToggle = useCallback(() => {
    setTransport(mockServerEnabled ? webHidIdentifier : mockserverIdentifier);
  }, [setTransport, mockServerEnabled]);

  const onUrlChange = useCallback(
    (url: string) => {
      setMockServerUrl(url);
    },
    [setMockServerUrl],
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
