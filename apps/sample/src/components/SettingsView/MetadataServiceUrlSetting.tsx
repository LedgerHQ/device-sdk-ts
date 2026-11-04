import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
import { selectMetadataServiceUrl } from "@/state/settings/selectors";
import { setMetadataServiceUrl } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const MetadataServiceUrlSetting: React.FC = () => {
  const metadataServiceUrl = useSelector(selectMetadataServiceUrl);
  const dispatch = useDispatch();

  const setMetadataServiceUrlFn = useCallback(
    (value: string) => {
      dispatch(setMetadataServiceUrl({ metadataServiceUrl: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      setMetadataServiceUrlFn(value);
    },
    [setMetadataServiceUrlFn],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Metadata Service URL"
          value={metadataServiceUrl}
          onChange={onValueChange}
          placeholder="https://nft.api.live.ledger.com"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectMetadataServiceUrl}
        setStateAction={setMetadataServiceUrlFn}
      />
    </SettingBox>
  );
};
