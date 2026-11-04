import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { Link } from "@ledgerhq/lumen-ui-react";
import { Refresh } from "@ledgerhq/lumen-ui-react/symbols";

import { type RootState, storeInitialState } from "@/state/store";

interface ResetSettingProps<T> {
  stateSelector: (state: RootState) => T;
  setStateAction: (newState: T) => void;
}

/**
 * ResetSetting is a CTA to reset the state of a given selector to its initial value.
 * If the state is similar to the initial state, the CTA is not displayed.
 */
export const ResetSettingCTA = <T,>({
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

  if (!isDifferent) {
    return null;
  }

  return (
    <div className="flex shrink self-center mr-8">
      <Link
        appearance="base"
        size="sm"
        disabled={!isDifferent}
        icon={Refresh}
        onClick={() => setStateAction(initialState)}
      >
        Reset
      </Link>
    </div>
  );
};
