import React from "react";
import { type DitheringAlgorithm } from "@ledgerhq/dmk-ledger-wallet";

import { SelectInput } from "@/components/fields";

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
    <div className="flex flex-col gap-y-8">
      <SelectInput
        label="Dithering Algorithm"
        isDisabled={isDisabled}
        value={DITHERING_OPTIONS.find((o) => o.value === ditheringAlgorithm)}
        onChange={(newVal) =>
          newVal && onDitheringChange(newVal.value as DitheringAlgorithm)
        }
        options={DITHERING_OPTIONS}
      />
      <div
        className="flex flex-row items-center gap-x-8"
        style={{ marginTop: 8, marginBottom: 8 }}
      >
        <span className="body-3 text-muted">Contrast</span>
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
        <span className="body-3 text-muted">{contrast.toFixed(1)}</span>
      </div>
    </div>
  );
};
