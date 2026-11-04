import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
import { selectSpeculosUrl } from "@/state/settings/selectors";
import { setSpeculosUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const SpeculosUrlSetting: React.FC = () => {
  const speculosUrl = useSelector(selectSpeculosUrl);
  const dispatch = useDispatch();

  const setSpeculosUrlFn = useCallback(
    (value: string) => {
      dispatch(setSpeculosUrl({ speculosUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Speculos URL"
          value={speculosUrl}
          onChange={setSpeculosUrlFn}
          placeholder="http://127.0.0.1:5000"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectSpeculosUrl}
        setStateAction={setSpeculosUrlFn}
      />
    </SettingBox>
  );
};
