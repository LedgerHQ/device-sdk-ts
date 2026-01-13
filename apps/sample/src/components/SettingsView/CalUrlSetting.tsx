import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectCalUrl } from "@/state/settings/selectors";
import { setCalUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const CalUrlSetting: React.FC = () => {
  const calUrl = useSelector(selectCalUrl);
  const dispatch = useDispatch();

  const setCalUrlFn = useCallback(
    (value: string) => {
      dispatch(setCalUrl({ calUrl: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      setCalUrlFn(value);
    },
    [setCalUrlFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>CAL URL</InputLabel>}
          value={calUrl}
          onChange={onValueChange}
          placeholder="https://crypto-assets-service.api.ledger.com/v1"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectCalUrl}
        setStateAction={setCalUrlFn}
      />
    </SettingBox>
  );
};
