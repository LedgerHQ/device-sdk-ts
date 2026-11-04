import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Switch } from "@/components/fields";
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
      <div className="flex flex-1 flex-col items-stretch">
        <Switch
          onChange={onToggle}
          checked={speculosEnabled}
          name="switch-speculos"
          label="Enable Speculos"
          data-testid="switch_speculos"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectTransportType}
        setStateAction={setTransportTypeFn}
      />
    </SettingBox>
  );
};
