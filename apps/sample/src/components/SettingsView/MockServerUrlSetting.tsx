import React, { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Input, SelectInput } from "@ledgerhq/react-ui";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";
import { selectMockServerUrl } from "@/state/settings/selectors";
import { setMockServerUrl } from "@/state/settings/slice";
import {
  DEFAULT_MOCK_SERVER_URL_LOCAL,
  DEFAULT_MOCK_SERVER_URL_REMOTE,
} from "@/utils/const";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

type Option = { label: string; value: string };

const CUSTOM_VALUE = "custom";

const urlOptions: Option[] = [
  { label: "Localhost", value: DEFAULT_MOCK_SERVER_URL_LOCAL },
  { label: "Remote", value: DEFAULT_MOCK_SERVER_URL_REMOTE },
  { label: "Custom", value: CUSTOM_VALUE },
];

const isPresetUrl = (url: string) =>
  url === DEFAULT_MOCK_SERVER_URL_LOCAL ||
  url === DEFAULT_MOCK_SERVER_URL_REMOTE;

export const MockServerUrlSetting: React.FC = () => {
  const mockServerUrl = useSelector(selectMockServerUrl);
  const dispatch = useDispatch();

  // Tracks an explicit "Custom" selection so it sticks even if the typed
  // value happens to match a preset URL.
  const [manualCustom, setManualCustom] = useState(false);

  const setMockServerUrlFn = useCallback(
    (value: string) => {
      dispatch(setMockServerUrl({ mockServerUrl: value }));
    },
    [dispatch],
  );

  const resetMockServerUrlFn = useCallback(
    (value: string) => {
      setManualCustom(false);
      setMockServerUrlFn(value);
    },
    [setMockServerUrlFn],
  );

  const isCustom = manualCustom || !isPresetUrl(mockServerUrl);
  const selectedOption = urlOptions.find((opt) =>
    isCustom ? opt.value === CUSTOM_VALUE : opt.value === mockServerUrl,
  );

  const onOptionChange = useCallback(
    (option: Option | null) => {
      if (!option) return;
      if (option.value === CUSTOM_VALUE) {
        setManualCustom(true);
      } else {
        setManualCustom(false);
        setMockServerUrlFn(option.value);
      }
    },
    [setMockServerUrlFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch" rowGap={2}>
        <SelectInput
          renderLeft={() => <SelectInputLabel>Mock Server</SelectInputLabel>}
          options={urlOptions}
          value={selectedOption}
          onChange={onOptionChange}
          isMulti={false}
          isSearchable={false}
          placeholder="Select mock server"
        />
        <Input
          renderLeft={<InputLabel>URL</InputLabel>}
          value={mockServerUrl}
          onChange={setMockServerUrlFn}
          placeholder="http://127.0.0.1:9752"
          disabled={!isCustom}
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectMockServerUrl}
        setStateAction={resetMockServerUrlFn}
      />
    </SettingBox>
  );
};
