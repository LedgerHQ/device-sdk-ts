import React, { useCallback } from "react";
import { speculosIdentifier } from "@ledgerhq/device-transport-kit-speculos";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Switch } from "@ledgerhq/react-ui";

import { useSetTransport, useTransport } from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const SpeculosToggleSetting: React.FC = () => {
  const transport = useTransport();
  const setTransport = useSetTransport();

  const speculosEnabled = transport === speculosIdentifier;

  const onToggle = useCallback(() => {
    setTransport(speculosEnabled ? webHidIdentifier : speculosIdentifier);
  }, [setTransport, speculosEnabled]);

  return (
    <SettingBox title="Speculos">
      <Switch
        onChange={onToggle}
        checked={speculosEnabled}
        name="switch-speculos"
        label="Enable Speculos"
        data-testid="switch_speculos"
      />
    </SettingBox>
  );
};
