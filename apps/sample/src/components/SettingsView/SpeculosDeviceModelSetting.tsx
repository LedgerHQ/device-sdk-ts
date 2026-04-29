import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Flex, SelectInput } from "@ledgerhq/react-ui";

import { SelectInputLabel } from "@/components/InputLabel";
import { selectSpeculosDeviceModel } from "@/state/settings/selectors";
import { setSpeculosDeviceModel } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

type Option = { label: string; value: string };

const deviceModelOptions: Option[] = [
  { label: "Nano S", value: DeviceModelId.NANO_S },
  { label: "Nano S Plus", value: DeviceModelId.NANO_SP },
  { label: "Nano X", value: DeviceModelId.NANO_X },
  { label: "Stax", value: DeviceModelId.STAX },
  { label: "Flex", value: DeviceModelId.FLEX },
  { label: "Apex", value: DeviceModelId.APEX },
];

export const SpeculosDeviceModelSetting: React.FC = () => {
  const speculosDeviceModel = useSelector(selectSpeculosDeviceModel);
  const dispatch = useDispatch();

  const selectedOption = deviceModelOptions.find(
    (opt) => opt.value === speculosDeviceModel,
  );

  const setDeviceModelFn = useCallback(
    (value: DeviceModelId) => {
      dispatch(setSpeculosDeviceModel({ speculosDeviceModel: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (option: Option | null) => {
      if (option) {
        setDeviceModelFn(option.value as DeviceModelId);
      }
    },
    [setDeviceModelFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <SelectInput
          renderLeft={() => <SelectInputLabel>Device Model</SelectInputLabel>}
          options={deviceModelOptions}
          value={selectedOption}
          onChange={onValueChange}
          isMulti={false}
          isSearchable={false}
          placeholder="Select device model"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectSpeculosDeviceModel}
        setStateAction={setDeviceModelFn}
      />
    </SettingBox>
  );
};
