import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectAppProvider } from "@/state/settings/selectors";
import { setAppProvider } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const AppProviderSetting: React.FC = () => {
  const appProvider = useSelector(selectAppProvider);
  const dispatch = useDispatch();

  const onValueChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        dispatch(setAppProvider({ appProvider: parsed }));
      }
    },
    [dispatch],
  );

  return (
    <SettingBox>
      <Input
        renderLeft={<InputLabel>App Provider ID (must be ≥ 1)</InputLabel>}
        value={String(appProvider)}
        onChange={onValueChange}
        type="number"
        placeholder="Provider ID"
      />
    </SettingBox>
  );
};
