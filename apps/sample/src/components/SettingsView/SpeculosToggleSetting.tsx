import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { speculosIdentifier } from "@ledgerhq/device-transport-kit-speculos";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { Switch } from "@ledgerhq/react-ui";

import { selectTransport } from "@/state/settings/selectors";
import { setTransport } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const SpeculosToggleSetting: React.FC = () => {
  const transport = useSelector(selectTransport);
  const dispatch = useDispatch();

  const speculosEnabled = transport === speculosIdentifier;

  const onToggle = useCallback(() => {
    dispatch(
      setTransport({
        transport: speculosEnabled ? webHidIdentifier : speculosIdentifier,
      }),
    );
  }, [dispatch, speculosEnabled]);

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
