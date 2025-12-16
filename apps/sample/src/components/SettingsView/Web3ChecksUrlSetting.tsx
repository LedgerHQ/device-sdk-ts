import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectWeb3ChecksUrl } from "@/state/settings/selectors";
import { setWeb3ChecksUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const Web3ChecksUrlSetting: React.FC = () => {
  const web3ChecksUrl = useSelector(selectWeb3ChecksUrl);
  const dispatch = useDispatch();

  const setWeb3ChecksUrlFn = useCallback(
    (value: string) => {
      dispatch(setWeb3ChecksUrl({ web3ChecksUrl: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      setWeb3ChecksUrlFn(value);
    },
    [setWeb3ChecksUrlFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Web3Checks Provider URL</InputLabel>}
          value={web3ChecksUrl}
          onChange={onValueChange}
          placeholder="https://web3checks-backend.api.ledger.com/v3"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectWeb3ChecksUrl}
        setStateAction={setWeb3ChecksUrlFn}
      />
    </SettingBox>
  );
};
