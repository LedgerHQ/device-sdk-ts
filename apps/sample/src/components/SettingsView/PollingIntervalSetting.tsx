import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectPollingInterval } from "@/state/settings/selectors";
import { setPollingInterval } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const PollingIntervalSetting: React.FC = () => {
  const pollingInterval = useSelector(selectPollingInterval);
  const dispatch = useDispatch();
  const [localValue, setLocalValue] = useState(String(pollingInterval));

  // Sync local value when redux state changes externally (e.g., reset)
  useEffect(() => {
    setLocalValue(String(pollingInterval));
  }, [pollingInterval]);

  const setPollingIntervalFn = useCallback(
    (value: number) => {
      dispatch(setPollingInterval({ pollingInterval: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      setLocalValue(value);

      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        setPollingIntervalFn(parsed);
      }
    },
    [setPollingIntervalFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={
            <InputLabel>
              Polling Interval in ms (0 to disable, 1000ms minimum)
            </InputLabel>
          }
          value={localValue}
          onChange={onValueChange}
          type="number"
          placeholder="Polling interval"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectPollingInterval}
        setStateAction={setPollingIntervalFn}
      />
    </SettingBox>
  );
};
