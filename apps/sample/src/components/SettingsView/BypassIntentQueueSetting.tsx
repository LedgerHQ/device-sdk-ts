import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Switch } from "@/components/fields";
import { selectBypassIntentQueue } from "@/state/settings/selectors";
import { setBypassIntentQueue } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const BypassIntentQueueSetting: React.FC = () => {
  const bypassIntentQueue = useSelector(selectBypassIntentQueue);
  const dispatch = useDispatch();

  const setBypassIntentQueueFn = useCallback(
    (value: boolean) => {
      dispatch(setBypassIntentQueue({ bypassIntentQueue: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(() => {
    setBypassIntentQueueFn(!bypassIntentQueue);
  }, [setBypassIntentQueueFn, bypassIntentQueue]);

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Switch
          onChange={onToggle}
          checked={bypassIntentQueue}
          name="switch-bypass-intent-queue"
          label="Bypass Intent Queue (UNSAFE)"
          data-testid="switch_bypass-intent-queue"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectBypassIntentQueue}
        setStateAction={setBypassIntentQueueFn}
      />
    </SettingBox>
  );
};
