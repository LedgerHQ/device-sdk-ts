import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Secure channel WebSocket URL</InputLabel>}
          value={webSocketUrl}
          onChange={onValueChange}
          placeholder="wss://scriptrunner.api.live.ledger.com/update"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectWebSocketUrl}
        setStateAction={setWebSocketUrlFn}
      />
    </SettingBox>
  );
};
