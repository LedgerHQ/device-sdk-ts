import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Mock Server URL</InputLabel>}
          value={mockServerUrl}
          onChange={setMockServerUrlFn}
          placeholder="http://127.0.0.1:4000"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectMockServerUrl}
        setStateAction={setMockServerUrlFn}
      />
    </SettingBox>
  );
};
