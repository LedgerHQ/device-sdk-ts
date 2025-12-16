import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { selectWeb3ChecksUrl } from "@/state/settings/selectors";
import { setWeb3ChecksUrl } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const Web3ChecksUrlSetting: React.FC = () => {
  const web3ChecksUrl = useSelector(selectWeb3ChecksUrl);
  const dispatch = useDispatch();

  const onValueChange = useCallback(
    (value: string) => {
        dispatch(setWeb3ChecksUrl({ web3ChecksUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox title="Web3Checks Provider URL">
      <Input
        value={web3ChecksUrl}
        onChange={onValueChange}
        placeholder="https://web3checks-backend.api.ledger.com/v3"
      />
    </SettingBox>
  );
};
