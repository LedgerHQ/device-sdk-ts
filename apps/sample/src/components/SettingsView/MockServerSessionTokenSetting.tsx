import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
import { selectMockServerSessionToken } from "@/state/settings/selectors";
import { setMockServerSessionToken } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const MockServerSessionTokenSetting: React.FC = () => {
  const mockServerSessionToken = useSelector(selectMockServerSessionToken);
  const dispatch = useDispatch();

  const setMockServerSessionTokenFn = useCallback(
    (value: string) => {
      dispatch(setMockServerSessionToken({ mockServerSessionToken: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Mock Server Session Token"
          value={mockServerSessionToken}
          onChange={setMockServerSessionTokenFn}
          placeholder="Auto-provisioned when empty"
          data-testid="input_mock-server-session-token"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectMockServerSessionToken}
        setStateAction={setMockServerSessionTokenFn}
      />
    </SettingBox>
  );
};
