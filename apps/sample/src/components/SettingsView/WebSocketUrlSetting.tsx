import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
import { selectWebSocketUrl } from "@/state/settings/selectors";
import { setWebSocketUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const WebSocketUrlSetting: React.FC = () => {
  const webSocketUrl = useSelector(selectWebSocketUrl);
  const dispatch = useDispatch();

  const setWebSocketUrlFn = useCallback(
    (value: string) => {
      dispatch(setWebSocketUrl({ webSocketUrl: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      setWebSocketUrlFn(value);
    },
    [setWebSocketUrlFn],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Secure channel WebSocket URL"
          value={webSocketUrl}
          onChange={onValueChange}
          placeholder="wss://scriptrunner.api.live.ledger.com/update"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectWebSocketUrl}
        setStateAction={setWebSocketUrlFn}
      />
    </SettingBox>
  );
};
