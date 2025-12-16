import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectSpeculosUrl } from "@/state/settings/selectors";
import { setSpeculosUrl } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const SpeculosUrlSetting: React.FC = () => {
  const speculosUrl = useSelector(selectSpeculosUrl);
  const dispatch = useDispatch();

  const onChange = useCallback(
    (value: string) => {
      dispatch(setSpeculosUrl({ speculosUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <Input
        renderLeft={<InputLabel>Speculos URL</InputLabel>}
        value={speculosUrl}
        onChange={onChange}
        placeholder="http://127.0.0.1:5000"
      />
    </SettingBox>
  );
};
