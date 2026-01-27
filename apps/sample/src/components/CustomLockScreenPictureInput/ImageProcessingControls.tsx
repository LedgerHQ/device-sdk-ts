import React from "react";
import { type DitheringAlgorithm } from "@ledgerhq/dmk-ledger-wallet";
import { Flex, SelectInput } from "@ledgerhq/react-ui";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";

import { DITHERING_OPTIONS } from "./constants";
import { RangeInput } from "./styles";

export type ImageProcessingControlsProps = {
  ditheringAlgorithm: DitheringAlgorithm;
  onDitheringChange: (value: DitheringAlgorithm) => void;
  contrast: number;
  onContrastChange: (value: number) => void;
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
      <Flex
        flexDirection="row"
        alignItems="center"
        columnGap={3}
        style={{ marginTop: 8, marginBottom: 8 }}
      >
        <InputLabel>Contrast</InputLabel>
        <RangeInput
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={contrast}
          onChange={(e) => onContrastChange(parseFloat(e.target.value))}
          disabled={isDisabled}
          style={{ width: 200 }}
        />
        <InputLabel>{contrast.toFixed(1)}</InputLabel>
      </Flex>
    </Flex>
  );
};
