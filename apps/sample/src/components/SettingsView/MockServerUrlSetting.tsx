import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
import { selectMockServerUrl } from "@/state/settings/selectors";
import { setMockServerUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const MockServerUrlSetting: React.FC = () => {
  const mockServerUrl = useSelector(selectMockServerUrl);
  const dispatch = useDispatch();

  const setMockServerUrlFn = useCallback(
    (value: string) => {
      dispatch(setMockServerUrl({ mockServerUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Mock Server URL"
          value={mockServerUrl}
          onChange={setMockServerUrlFn}
          placeholder="http://127.0.0.1:4000"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectMockServerUrl}
        setStateAction={setMockServerUrlFn}
      />
    </SettingBox>
  );
};
