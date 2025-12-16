import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectOriginToken } from "@/state/settings/selectors";
import { setOriginToken } from "@/state/settings/slice";

import { ResetSetting } from "./ResetSetting";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Origin Token</InputLabel>}
          value={originToken}
          onChange={setOriginTokenFn}
          placeholder="origin-token"
        />
      </Flex>
      <ResetSetting
        stateSelector={selectOriginToken}
        setStateAction={setOriginTokenFn}
      />
    </SettingBox>
  );
};
