import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectSpeculosVncUrl } from "@/state/settings/selectors";
import { setSpeculosVncUrl } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const SpeculosVncUrlSetting: React.FC = () => {
  const speculosVncUrl = useSelector(selectSpeculosVncUrl);
  const dispatch = useDispatch();

  const onChange = useCallback(
    (value: string) => {
      dispatch(setSpeculosVncUrl({ speculosVncUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <Input
        renderLeft={<InputLabel>Speculos VNC URL</InputLabel>}
        value={speculosVncUrl}
        onChange={onChange}
        placeholder="ws://127.0.0.1:5900"
      />
    </SettingBox>
  );
};
