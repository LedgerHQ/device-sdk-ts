import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input } from "@ledgerhq/react-ui";

import { InputLabel } from "@/components/InputLabel";
import { selectFirmwareDistributionSalt } from "@/state/settings/selectors";
import { setFirmwareDistributionSalt } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

export const FirmwareDistributionSaltSetting: React.FC = () => {
  const firmwareDistributionSalt = useSelector(selectFirmwareDistributionSalt);
  const dispatch = useDispatch();

  const setFirmwareDistributionSaltFn = useCallback(
    (value: string) => {
      dispatch(
        setFirmwareDistributionSalt({ firmwareDistributionSalt: value }),
      );
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (value: string) => {
      setFirmwareDistributionSaltFn(value);
    },
    [setFirmwareDistributionSaltFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <Input
          renderLeft={<InputLabel>Firmware distribution salt</InputLabel>}
          value={firmwareDistributionSalt}
          onChange={onValueChange}
          placeholder="0"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectFirmwareDistributionSalt}
        setStateAction={setFirmwareDistributionSaltFn}
      />
    </SettingBox>
  );
};
