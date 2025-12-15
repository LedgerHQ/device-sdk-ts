import React, { useCallback } from "react";
import { Input } from "@ledgerhq/react-ui";

import { useSetWeb3ChecksUrl, useWeb3ChecksUrl } from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const Web3ChecksUrlSetting: React.FC = () => {
  const web3ChecksUrl = useWeb3ChecksUrl();
  const setWeb3ChecksUrl = useSetWeb3ChecksUrl();

  const onValueChange = useCallback(
    (value: string) => {
      setWeb3ChecksUrl(value);
    },
    [setWeb3ChecksUrl],
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
