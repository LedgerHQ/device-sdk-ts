import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Speculos URL</InputLabel>}
          value={speculosUrl}
          onChange={setSpeculosUrlFn}
          placeholder="http://127.0.0.1:5000"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectSpeculosUrl}
        setStateAction={setSpeculosUrlFn}
      />
    </SettingBox>
  );
};
