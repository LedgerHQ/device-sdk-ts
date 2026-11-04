import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
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
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Web3Checks Provider URL"
          value={web3ChecksUrl}
          onChange={onValueChange}
          placeholder="https://global.api.prd.ledger.com/transaction-checks/v3"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectWeb3ChecksUrl}
        setStateAction={setWeb3ChecksUrlFn}
      />
    </SettingBox>
  );
};
