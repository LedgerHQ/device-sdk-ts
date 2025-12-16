import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectMockServerUrl } from "@/state/settings/selectors";
import { setMockServerUrl } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const MockServerUrlSetting: React.FC = () => {
  const mockServerUrl = useSelector(selectMockServerUrl);
  const dispatch = useDispatch();

  const onChange = useCallback(
    (url: string) => {
      dispatch(setMockServerUrl({ mockServerUrl: url }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <Input
        renderLeft={<InputLabel>Mock Server URL</InputLabel>}
        value={mockServerUrl}
        onChange={onChange}
        placeholder="http://127.0.0.1:4000"
      />
    </SettingBox>
  );
};
