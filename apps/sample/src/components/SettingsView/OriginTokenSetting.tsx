import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
import { selectOriginToken } from "@/state/settings/selectors";
import { setOriginToken } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const OriginTokenSetting: React.FC = () => {
  const originToken = useSelector(selectOriginToken);
  const dispatch = useDispatch();

  const setOriginTokenFn = useCallback(
    (value: string) => {
      dispatch(setOriginToken({ originToken: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Origin Token"
          value={originToken}
          onChange={setOriginTokenFn}
          placeholder="origin-token"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectOriginToken}
        setStateAction={setOriginTokenFn}
      />
    </SettingBox>
  );
};
