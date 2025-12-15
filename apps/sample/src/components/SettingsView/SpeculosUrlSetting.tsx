import React from "react";
import { Input } from "@ledgerhq/react-ui";

import { useSetSpeculosUrl, useSpeculosUrl } from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const SpeculosUrlSetting: React.FC = () => {
  const speculosUrl = useSpeculosUrl();
  const setSpeculosUrl = useSetSpeculosUrl();

  return (
    <SettingBox title="Speculos URL">
      <Input
        value={speculosUrl}
        onChange={setSpeculosUrl}
        placeholder="http://127.0.0.1:5000"
      />
    </SettingBox>
  );
};
