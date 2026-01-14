import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  Flex,
  Icons,
  InfiniteLoader,
  Input,
  Text,
} from "@ledgerhq/react-ui";
import styled from "styled-components";

import { CopyableApdu } from "@/components/ApduView/CopyableApdu";
import { type ModeProps } from "@/components/ApduView/types";
import { InputLabelWithTooltip } from "@/components/InputLabel";

import { AddDataSegmentButton } from "./AddDataSegmentButton";
import { DataSegmentInput } from "./DataSegmentInput";
import { PresetSelector } from "./PresetSelector";
import { useApduBuilder } from "./useApduBuilder";

const Section = styled(Flex).attrs({
  flexDirection: "column",
  rowGap: 4,
})``;

const SectionHeader = styled(Text).attrs({
  variant: "small",
  fontWeight: "medium",
  color: "neutral.c80",
})``;

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
    <Flex flexDirection="column" rowGap={8}>
      {/* Preset selector */}
      <PresetSelector
        selectedPresetId={apduBuilder.selectedPresetId}
        onSelect={apduBuilder.applyPreset}
      />

      {/* Header section */}
      <Section>
        <SectionHeader>Header</SectionHeader>
        <Flex flexDirection="row" columnGap={4}>
          <Flex flexDirection="column" rowGap={2}>
            <Input
              name="cla"
              renderLeft={() => (
                <InputLabelWithTooltip hint="Instruction class">
                  CLA
                </InputLabelWithTooltip>
              )}
              value={apduBuilder.header.cla}
              onChange={(value) => apduBuilder.setHeaderField("cla", value)}
            />
            {!apduBuilder.validation.header.cla.isValid && (
              <Text variant="extraSmall" color="error.c80">
                {apduBuilder.validation.header.cla.error}
              </Text>
            )}
          </Flex>
          <Flex flexDirection="column" rowGap={2}>
            <Input
              name="ins"
              renderLeft={() => (
                <InputLabelWithTooltip hint="Instruction code">
                  INS
                </InputLabelWithTooltip>
              )}
              value={apduBuilder.header.ins}
              onChange={(value) => apduBuilder.setHeaderField("ins", value)}
            />
            {!apduBuilder.validation.header.ins.isValid && (
              <Text variant="extraSmall" color="error.c80">
                {apduBuilder.validation.header.ins.error}
              </Text>
            )}
          </Flex>
          <Flex flexDirection="column" rowGap={2}>
            <Input
              name="p1"
              renderLeft={() => (
                <InputLabelWithTooltip hint="Instruction first parameter">
                  P1
                </InputLabelWithTooltip>
              )}
              value={apduBuilder.header.p1}
              onChange={(value) => apduBuilder.setHeaderField("p1", value)}
            />
            {!apduBuilder.validation.header.p1.isValid && (
              <Text variant="extraSmall" color="error.c80">
                {apduBuilder.validation.header.p1.error}
              </Text>
            )}
          </Flex>
          <Flex flexDirection="column" rowGap={2}>
            <Input
              name="p2"
              renderLeft={() => (
                <InputLabelWithTooltip hint="Instruction second parameter">
                  P2
                </InputLabelWithTooltip>
              )}
              value={apduBuilder.header.p2}
              onChange={(value) => apduBuilder.setHeaderField("p2", value)}
            />
            {!apduBuilder.validation.header.p2.isValid && (
              <Text variant="extraSmall" color="error.c80">
                {apduBuilder.validation.header.p2.error}
              </Text>
            )}
          </Flex>
        </Flex>
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
          <Text variant="small" color="error.c80">
            Invalid APDU configuration
          </Text>
        )}
        {builderPreview.errors.length > 0 && (
          <Flex flexDirection="column" rowGap={1}>
            {builderPreview.errors.map((error, index) => (
              <Text
                key={index}
                variant="extraSmall"
                color="error.c80"
                style={{ wordBreak: "break-all" }}
              >
                {error}
              </Text>
            ))}
          </Flex>
        )}
      </Section>

      {/* Submit button */}
      <Flex flexDirection="row" justifyContent="flex-end">
        <Button
          variant="main"
          onClick={() => void handleSubmit()}
          disabled={isSubmitDisabled}
          Icon={() =>
            loading ? <InfiniteLoader size={20} /> : <Icons.ArrowRight />
          }
          data-testid="CTA_send-apdu"
        >
          Send
        </Button>
      </Flex>
    </Flex>
  );
};
