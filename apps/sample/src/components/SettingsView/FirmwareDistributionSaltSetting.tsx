import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Input } from "@/components/fields";
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
      <div className="flex flex-1 flex-col items-stretch">
        <Input
          label="Firmware distribution salt"
          value={firmwareDistributionSalt}
          onChange={onValueChange}
          placeholder="0"
        />
      </div>
      <ResetSettingCTA
        stateSelector={selectFirmwareDistributionSalt}
        setStateAction={setFirmwareDistributionSaltFn}
      />
    </SettingBox>
  );
};
