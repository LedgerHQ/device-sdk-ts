import React from "react";
import { Input } from "@ledgerhq/react-ui";

import { useOriginToken, useSetOriginToken } from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const OriginTokenSetting: React.FC = () => {
  const originToken = useOriginToken();
  const setOriginToken = useSetOriginToken();

  return (
    <SettingBox title="Origin Token">
      <Input
        value={originToken}
        onChange={setOriginToken}
        placeholder="origin-token"
      />
    </SettingBox>
  );
};

