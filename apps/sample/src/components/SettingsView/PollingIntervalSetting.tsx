import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { useDebounce } from "@/hooks/useDebounce";
import { selectPollingInterval } from "@/state/settings/selectors";
import { setPollingInterval } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

const DEBOUNCE_DELAY_MS = 500;

export const PollingIntervalSetting: React.FC = () => {
  const pollingInterval = useSelector(selectPollingInterval);
  const dispatch = useDispatch();
  const [localValue, setLocalValue] = useState(String(pollingInterval));
  const debouncedValue = useDebounce(localValue, DEBOUNCE_DELAY_MS);

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

  // Update redux state when debounced value changes
  useEffect(() => {
    const parsed = parseInt(debouncedValue, 10);
    if (isNaN(parsed) || parsed === pollingInterval) return;
    setPollingIntervalFn(parsed);
  }, [debouncedValue, pollingInterval, setPollingIntervalFn]);

  const onValueChange = useCallback((value: string) => {
    setLocalValue(value);
  }, []);

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
