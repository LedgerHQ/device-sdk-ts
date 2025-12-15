import React, { useCallback } from "react";
import { Input } from "@ledgerhq/react-ui";

import { useCalUrl, useSetCalUrl } from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const CalUrlSetting: React.FC = () => {
  const calUrl = useCalUrl();
  const setCalUrl = useSetCalUrl();

  const onValueChange = useCallback(
    (value: string) => {
      setCalUrl(value);
    },
    [setCalUrl],
  );

  return (
    <SettingBox title="CAL URL">
      <Input
        value={calUrl}
        onChange={onValueChange}
        placeholder="https://crypto-assets-service.api.ledger.com/v1"
      />
    </SettingBox>
  );
};
