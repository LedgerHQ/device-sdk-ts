import React, { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type SolanaSignerFeaturesNames } from "@ledgerhq/device-signer-kit-solana";
import { Flex, SelectInput } from "@ledgerhq/react-ui";

import { SelectInputLabel } from "@/components/InputLabel";
import { selectSolanaDisabledFeatures } from "@/state/settings/selectors";
import { setSolanaDisabledFeatures } from "@/state/settings/slice";

import { ResetSettingCTA } from "./ResetSetting";
import { SettingBox } from "./SettingBox";

type Option = { label: string; value: SolanaSignerFeaturesNames };

// Record keyed by feature name so a new signer feature fails typecheck here
const featureLabels: Record<SolanaSignerFeaturesNames, string> = {
  spl: "SPL tokens",
  transactionChecks: "Transaction checks",
  delayedSigning: "Delayed signing",
  genericClearSign: "Generic clear sign",
  v1Transactions: "v1 transactions",
};

const featureOptions: Option[] = (
  Object.keys(featureLabels) as SolanaSignerFeaturesNames[]
).map((value) => ({ label: featureLabels[value], value }));

export const SolanaDisabledFeaturesSetting: React.FC = () => {
  const disabledFeatures = useSelector(selectSolanaDisabledFeatures);
  const dispatch = useDispatch();

  const selectedOptions = useMemo(
    () => featureOptions.filter((opt) => disabledFeatures.includes(opt.value)),
    [disabledFeatures],
  );

  const setDisabledFeaturesFn = useCallback(
    (value: SolanaSignerFeaturesNames[]) => {
      dispatch(setSolanaDisabledFeatures({ solanaDisabledFeatures: value }));
    },
    [dispatch],
  );

  const onValueChange = useCallback(
    (options: readonly Option[] | null) => {
      setDisabledFeaturesFn((options ?? []).map((opt) => opt.value));
    },
    [setDisabledFeaturesFn],
  );

  return (
    <SettingBox>
      <Flex flex={1} flexDirection="column" alignItems="stretch">
        <SelectInput
          renderLeft={() => (
            <SelectInputLabel>Disabled features</SelectInputLabel>
          )}
          options={featureOptions}
          value={selectedOptions}
          onChange={onValueChange}
          isMulti={true}
          isSearchable={false}
          closeMenuOnSelect={false}
          placeholder="None"
        />
      </Flex>
      <ResetSettingCTA
        stateSelector={selectSolanaDisabledFeatures}
        setStateAction={setDisabledFeaturesFn}
      />
    </SettingBox>
  );
};
