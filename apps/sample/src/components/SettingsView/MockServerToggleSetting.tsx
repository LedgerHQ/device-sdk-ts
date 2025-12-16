import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Switch } from "@ledgerhq/react-ui";

import { selectTransport } from "@/state/settings/selectors";
import { setTransport } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const MockServerToggleSetting: React.FC = () => {
  const transport = useSelector(selectTransport);
  const dispatch = useDispatch();

  const mockServerEnabled = transport === mockserverIdentifier;

  const onToggle = useCallback(() => {
    dispatch(
      setTransport({
        transport: mockServerEnabled ? webHidIdentifier : mockserverIdentifier,
      }),
    );
  }, [dispatch, mockServerEnabled]);

  return (
    <SettingBox>
      <Switch
        onChange={onToggle}
        checked={mockServerEnabled}
        name="switch-mock-server"
        label="Enable Mock server"
        data-testid="switch_mock-server"
      />
    </SettingBox>
  );
};

