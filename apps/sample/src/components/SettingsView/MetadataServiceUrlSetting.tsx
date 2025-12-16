import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectMetadataServiceUrl } from "@/state/settings/selectors";
import { setMetadataServiceUrl } from "@/state/settings/slice";

import { ResetSetting } from "./ResetSetting";
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
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Metadata Service URL</InputLabel>}
          value={metadataServiceUrl}
          onChange={onValueChange}
          placeholder="https://nft.api.live.ledger.com"
        />
      </Flex>
      <ResetSetting
        stateSelector={selectMetadataServiceUrl}
        setStateAction={setMetadataServiceUrlFn}
      />
    </SettingBox>
  );
};
