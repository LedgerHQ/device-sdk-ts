import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
import { selectReporterUrl } from "@/state/settings/selectors";
import { setReporterUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const ReporterUrlSetting: React.FC = () => {
  const reporterUrl = useSelector(selectReporterUrl);
  const dispatch = useDispatch();

  const setReporterUrlFn = useCallback(
    (value: string) => {
      dispatch(setReporterUrl({ reporterUrl: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      setReporterUrlFn(value);
    },
    [setReporterUrlFn],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Blind Signing Reporter URL"
          value={reporterUrl}
          onChange={onValueChange}
          placeholder="https://blind-signing.api.ledger.com/ingest"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectReporterUrl}
        setStateAction={setReporterUrlFn}
      />
    </SettingBox>
  );
};
