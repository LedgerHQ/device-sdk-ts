import React from "react";
import { Input } from "@ledgerhq/react-ui";

import {
  useSetSpeculosVncUrl,
  useSpeculosVncUrl,
} from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const SpeculosVncUrlSetting: React.FC = () => {
  const speculosVncUrl = useSpeculosVncUrl();
  const setSpeculosVncUrl = useSetSpeculosVncUrl();

  return (
    <SettingBox title="Speculos VNC URL">
      <Input
        value={speculosVncUrl}
        onChange={setSpeculosVncUrl}
        placeholder="ws://127.0.0.1:5900"
      />
    </SettingBox>
  );
};
