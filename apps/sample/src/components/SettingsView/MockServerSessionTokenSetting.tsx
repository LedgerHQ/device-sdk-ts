import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Mock Server Session Token</InputLabel>}
          value={mockServerSessionToken}
          onChange={setMockServerSessionTokenFn}
          placeholder="Auto-provisioned when empty"
          data-testid="input_mock-server-session-token"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectMockServerSessionToken}
        setStateAction={setMockServerSessionTokenFn}
      />
    </SettingBox>
  );
};
