import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@ledgerhq/lumen-ui-react";
import { ArrowRight } from "@ledgerhq/lumen-ui-react/symbols";

import { CopyableApdu } from "@/components/ApduView/CopyableApdu";
import { type ModeProps } from "@/components/ApduView/types";
import { Input } from "@/components/fields";

import { AddDataSegmentButton } from "./AddDataSegmentButton";
import { DataSegmentInput } from "./DataSegmentInput";
import { PresetSelector } from "./PresetSelector";
import { useApduBuilder } from "./useApduBuilder";

const Section: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col gap-16">{children}</div>
);

const SectionHeader: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="body-3-semi-bold text-muted">{children}</span>
);

export const BuilderModeInput: React.FC<ModeProps> = ({
  sendApdu,
  disabled = false,
}) => {
  const apduBuilder = useApduBuilder();
  const [loading, setLoading] = useState(false);

  const builderPreview = useMemo(() => {
    return apduBuilder.buildApdu();
  }, [apduBuilder]);

  const handleSubmit = useCallback(async () => {
    const { rawApdu } = apduBuilder.buildApdu();
    if (!rawApdu) return;

    setLoading(true);
    try {
      await sendApdu(rawApdu);
    } catch (error) {
      console.error("Error sending APDU:", error);
    } finally {
      setLoading(false);
    }
  }, [apduBuilder, sendApdu]);

  const isSubmitDisabled =
    disabled || loading || !apduBuilder.validation.isValid;

  return (
    <div className="flex flex-col gap-y-24">
      {/* Preset selector */}
      <PresetSelector
        selectedPresetId={apduBuilder.selectedPresetId}
        onSelect={apduBuilder.applyPreset}
      />

      {/* Header section */}
      <Section>
        <SectionHeader>Header</SectionHeader>
        <div className="flex flex-row gap-x-12">
          <div className="flex flex-col gap-y-4">
            <Input
              name="cla"
              label="CLA"
              hint="Instruction class"
              value={apduBuilder.header.cla}
              onChange={(value) => apduBuilder.setHeaderField("cla", value)}
            />
            {!apduBuilder.validation.header.cla.isValid && (
              <span className="body-4 text-error">
                {apduBuilder.validation.header.cla.error}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-y-4">
            <Input
              name="ins"
              label="INS"
              hint="Instruction code"
              value={apduBuilder.header.ins}
              onChange={(value) => apduBuilder.setHeaderField("ins", value)}
            />
            {!apduBuilder.validation.header.ins.isValid && (
              <span className="body-4 text-error">
                {apduBuilder.validation.header.ins.error}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-y-4">
            <Input
              name="p1"
              label="P1"
              hint="Instruction first parameter"
              value={apduBuilder.header.p1}
              onChange={(value) => apduBuilder.setHeaderField("p1", value)}
            />
            {!apduBuilder.validation.header.p1.isValid && (
              <span className="body-4 text-error">
                {apduBuilder.validation.header.p1.error}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-y-4">
            <Input
              name="p2"
              label="P2"
              hint="Instruction second parameter"
              value={apduBuilder.header.p2}
              onChange={(value) => apduBuilder.setHeaderField("p2", value)}
            />
            {!apduBuilder.validation.header.p2.isValid && (
              <span className="body-4 text-error">
                {apduBuilder.validation.header.p2.error}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* Data section */}
      <Section>
        <SectionHeader>Data</SectionHeader>
        {apduBuilder.dataSegments.map((segment) => {
          const segmentValidation = apduBuilder.validation.segments.find(
            (v) => v.id === segment.id,
          ) ?? { isValid: true };
          return (
            <DataSegmentInput
              key={segment.id}
              segment={segment}
              validation={segmentValidation}
              onUpdate={(updates) =>
                apduBuilder.updateDataSegment(segment.id, updates)
              }
              onRemove={() => apduBuilder.removeDataSegment(segment.id)}
            />
          );
        })}

        <AddDataSegmentButton onAdd={apduBuilder.addDataSegment} />
      </Section>

      {/* Raw APDU section */}
      <Section>
        <SectionHeader>Raw APDU</SectionHeader>
        {builderPreview.rawApdu ? (
          <CopyableApdu rawApdu={builderPreview.rawApdu} />
        ) : (
          <span className="body-3 text-error">Invalid APDU configuration</span>
        )}
        {builderPreview.errors.length > 0 && (
          <div className="flex flex-col gap-y-2">
            {builderPreview.errors.map((error, index) => (
              <span
                className="body-4 text-error"
                key={index}
                style={{ wordBreak: "break-all" }}
              >
                {error}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Submit button */}
      <div className="flex flex-row justify-end">
        <Button
          appearance="base"
          onClick={() => void handleSubmit()}
          disabled={isSubmitDisabled}
          icon={ArrowRight}
          loading={loading}
          data-testid="CTA_send-apdu"
        >
          Send
        </Button>
      </div>
    </div>
  );
};
