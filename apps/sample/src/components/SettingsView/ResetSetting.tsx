import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { Button } from "@ledgerhq/react-ui";

import { type RootState, storeInitialState } from "@/state/store";

interface ResetSettingProps<T> {
  stateSelector: (state: RootState) => T;
  setStateAction: (newState: T) => void;
}

export const ResetSetting = <T,>({
  stateSelector,
  setStateAction,
}: ResetSettingProps<T>) => {
  const state = useSelector(stateSelector);
  const initialState = useMemo(() => {
    return stateSelector(storeInitialState);
  }, [stateSelector]);

  const isDifferent = useMemo(() => {
    return JSON.stringify(state) !== JSON.stringify(initialState);
  }, [state, initialState]);

  return (
    <Button
      disabled={!isDifferent}
      onClick={() => setStateAction(initialState)}
    >
      Reset
    </Button>
  );
};
