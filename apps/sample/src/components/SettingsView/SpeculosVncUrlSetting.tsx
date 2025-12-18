import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectSpeculosVncUrl } from "@/state/settings/selectors";
import { setSpeculosVncUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const SpeculosVncUrlSetting: React.FC = () => {
  const speculosVncUrl = useSelector(selectSpeculosVncUrl);
  const dispatch = useDispatch();

  const setSpeculosVncUrlFn = useCallback(
    (value: string) => {
      dispatch(setSpeculosVncUrl({ speculosVncUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Speculos VNC URL</InputLabel>}
          value={speculosVncUrl}
          onChange={setSpeculosVncUrlFn}
          placeholder="ws://127.0.0.1:5900"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectSpeculosVncUrl}
        setStateAction={setSpeculosVncUrlFn}
      />
    </SettingBox>
  );
};
