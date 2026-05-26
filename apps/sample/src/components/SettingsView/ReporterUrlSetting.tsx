import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Blind Signing Reporter URL</InputLabel>}
          value={reporterUrl}
          onChange={onValueChange}
          placeholder="https://blind-signing.api.ledger.com/ingest/v1"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectReporterUrl}
        setStateAction={setReporterUrlFn}
      />
    </SettingBox>
  );
};
