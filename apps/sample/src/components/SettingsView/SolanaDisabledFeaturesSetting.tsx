import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type SolanaSignerFeaturesNames } from "@ledgerhq/device-signer-kit-solana";

import { Switch } from "@/components/fields";
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

  const setDisabledFeaturesFn = useCallback(
    (value: SolanaSignerFeaturesNames[]) => {
      dispatch(setSolanaDisabledFeatures({ solanaDisabledFeatures: value }));
    },
    [dispatch],
  );

  const onToggle = useCallback(
    (feature: SolanaSignerFeaturesNames) => {
      setDisabledFeaturesFn(
        disabledFeatures.includes(feature)
          ? disabledFeatures.filter((f) => f !== feature)
          : [...disabledFeatures, feature],
      );
    },
    [disabledFeatures, setDisabledFeaturesFn],
  );

  return (
    <SettingBox>
      <div className="flex flex-1 flex-col gap-12">
        <span className="body-2 text-muted">Disabled features</span>
        {featureOptions.map((option) => (
          <Switch
            key={option.value}
            name={`switch-solana-${option.value}`}
            label={option.label}
            checked={disabledFeatures.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
        ))}
      </div>
      <ResetSettingCTA
        stateSelector={selectSolanaDisabledFeatures}
        setStateAction={setDisabledFeaturesFn}
      />
    </SettingBox>
  );
};
