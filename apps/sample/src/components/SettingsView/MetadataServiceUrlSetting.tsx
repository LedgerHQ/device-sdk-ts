import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@ledgerhq/react-ui";

import { selectMetadataServiceUrl } from "@/state/settings/selectors";
import { setMetadataServiceUrl } from "@/state/settings/slice";

import { SettingBox } from "./SettingBox";

export const MetadataServiceUrlSetting: React.FC = () => {
  const metadataServiceUrl = useSelector(selectMetadataServiceUrl);
  const dispatch = useDispatch();

  const onValueChange = useCallback(
    (value: string) => {
        dispatch(setMetadataServiceUrl({ metadataServiceUrl: value }));
    },
    [dispatch],
  );

  return (
    <SettingBox title="Metadata Service URL">
      <Input
        value={metadataServiceUrl}
        onChange={onValueChange}
        placeholder="https://nft.api.live.ledger.com"
      />
    </SettingBox>
  );
};
