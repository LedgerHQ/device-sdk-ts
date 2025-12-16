import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { selectOriginToken } from "@/state/settings/selectors";
import { setOriginToken } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const OriginTokenSetting: React.FC = () => {
  const originToken = useSelector(selectOriginToken);
  const dispatch = useDispatch();

  const onChange = useCallback(
    (value: string) => {
      dispatch(setOriginToken({ originToken: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox title="Origin Token">
      <Input
        value={originToken}
        onChange={onChange}
        placeholder="origin-token"
      />
    </SettingBox>
  );
};
