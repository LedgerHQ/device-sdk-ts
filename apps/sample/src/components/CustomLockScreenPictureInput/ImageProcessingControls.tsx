import React from "react";
import { type DitheringAlgorithm } from "@ledgerhq/dmk-ledger-wallet";
import { Flex, Input, SelectInput, Switch } from "@ledgerhq/react-ui";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";

import { DITHERING_OPTIONS } from "./constants";
import { RangeInput } from "./styles";

export type ImageProcessingControlsProps = {
  ditheringAlgorithm: DitheringAlgorithm;
  onDitheringChange: (value: DitheringAlgorithm) => void;
  contrast: number;
  onContrastChange: (value: number) => void;
  compress: boolean;
  onCompressChange: (value: boolean) => void;
  unlockTimeout: number;
  onUnlockTimeoutChange: (value: number) => void;
  disabled: boolean;
  processing: boolean;
};

export const ImageProcessingControls: React.FC<
  ImageProcessingControlsProps
> = ({
  ditheringAlgorithm,
  onDitheringChange,
  contrast,
  onContrastChange,
  compress,
  onCompressChange,
  unlockTimeout,
  onUnlockTimeoutChange,
  disabled,
  processing,
}) => {
  const isDisabled = disabled || processing;

  return (
    <Flex flexDirection="column" rowGap={3}>
      <SelectInput
        renderLeft={() => (
          <SelectInputLabel>Dithering Algorithm</SelectInputLabel>
        )}
        isDisabled={isDisabled}
        value={DITHERING_OPTIONS.find((o) => o.value === ditheringAlgorithm)}
        isMulti={false}
        onChange={(newVal) =>
          newVal && onDitheringChange(newVal.value as DitheringAlgorithm)
        }
        options={DITHERING_OPTIONS}
        isSearchable={false}
      />

      <Flex flexDirection="column" rowGap={1}>
        <InputLabel>Contrast: {contrast.toFixed(1)}</InputLabel>
        <RangeInput
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={contrast}
          onChange={(e) => onContrastChange(parseFloat(e.target.value))}
          disabled={isDisabled}
        />
      </Flex>

      <Switch
        checked={compress}
        disabled={isDisabled}
        onChange={() => onCompressChange(!compress)}
        label="Compress image data (recommended)"
        name="compress"
      />

      <Input
        id="unlockTimeout"
        renderLeft={() => <InputLabel>unlockTimeout</InputLabel>}
        value={unlockTimeout}
        onChange={(val) =>
          onUnlockTimeoutChange(parseInt(String(val), 10) || 0)
        }
        type="number"
        disabled={disabled}
      />
    </Flex>
  );
};
