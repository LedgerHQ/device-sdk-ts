import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectCalUrl } from "@/state/settings/selectors";
import { setCalUrl } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const CalUrlSetting: React.FC = () => {
  const calUrl = useSelector(selectCalUrl);
  const dispatch = useDispatch();

  const onValueChange = useCallback(
    (value: string) => {
      dispatch(setCalUrl({ calUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <Input
        renderLeft={<InputLabel>CAL URL</InputLabel>}
        value={calUrl}
        onChange={onValueChange}
        placeholder="https://crypto-assets-service.api.ledger.com/v1"
      />
    </SettingBox>
  );
};
