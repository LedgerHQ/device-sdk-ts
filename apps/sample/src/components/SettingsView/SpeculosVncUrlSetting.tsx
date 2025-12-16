import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

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
    <SettingBox title="Speculos VNC URL">
      <Input
        value={speculosVncUrl}
        onChange={onChange}
        placeholder="ws://127.0.0.1:5900"
      />
    </SettingBox>
  );
};
