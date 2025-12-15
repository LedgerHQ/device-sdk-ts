import React, { useCallback } from "react";
import { Input } from "@ledgerhq/react-ui";

import {
  useMetadataServiceUrl,
  useSetMetadataServiceUrl,
} from "@/state/settings/hooks";

import { SettingBox } from "./SettingBox";

export const MetadataServiceUrlSetting: React.FC = () => {
  const metadataServiceUrl = useMetadataServiceUrl();
  const setMetadataServiceUrl = useSetMetadataServiceUrl();

  const onValueChange = useCallback(
    (value: string) => {
      setMetadataServiceUrl(value);
    },
    [setMetadataServiceUrl],
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
