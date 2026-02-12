import React from "react";
import {
  bufferToHexaString,
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceModelId,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Flex, Icons, Tag, Text, Tooltip } from "@ledgerhq/react-ui";
import styled from "styled-components";
import { inspect } from "util";

import { type FieldType } from "@/hooks/useForm";

export type DeviceActionResponseProps<Output, Error, IntermediateValue> = {
  args: Record<string, FieldType>;
  date: Date;
  id: number;
  /** Optional custom component to render the successful output */
  OutputComponent?: React.FC<{
    output: Output;
    deviceModelId: DeviceModelId;
  }>;
  deviceModelId?: DeviceModelId;
} & (
  | {
      deviceActionState: DeviceActionState<Output, Error, IntermediateValue>;
    }
  | { error: unknown }
);

export const deviceActionStatusToColor: Record<DeviceActionStatus, string> = {
  [DeviceActionStatus.NotStarted]: "primary.c100",
  [DeviceActionStatus.Pending]: "primary.c90",
  [DeviceActionStatus.Stopped]: "warning.c80",
  [DeviceActionStatus.Completed]: "success.c80",
  [DeviceActionStatus.Error]: "error.c80",
};

const TooltipTitle = styled(Text).attrs({
  mb: 2,
  variant: "small",
  color: "neutral.c60",
})`
  flex-grow: 0;
`;

function bufferStringifyReplacer(_key: string, value: unknown): unknown {
  // Pretty-print buffers to make signatures or public keys readable
  if (value instanceof Uint8Array) {
    return bufferToHexaString(value);
  }
  return value;
}

/**
 * Component to display an event emitted by a device action.
 */
function DeviceActionResponseInternal<
  Output,
  Error,
  IntermediateValue extends DeviceActionIntermediateValue,
>(
  props: DeviceActionResponseProps<Output, Error, IntermediateValue> & {
    isLatest: boolean;
  },
) {
  const { args, date, isLatest, id, OutputComponent, deviceModelId } = props;

  const isError = "error" in props;

  // Check if we have a completed state with custom output component
  const showCustomOutput =
    !isError &&
    "deviceActionState" in props &&
    props.deviceActionState.status === DeviceActionStatus.Completed &&
    OutputComponent &&
    deviceModelId &&
    "output" in props.deviceActionState &&
    props.deviceActionState.output !== undefined;

  return (
    <Flex
      flexDirection="column"
      alignItems="flex-start"
      bg={isLatest ? "neutral.c40" : "transparent"}
      p={3}
      borderRadius={2}
      flex={1}
      overflow="scroll"
    >
      <Tooltip
        placement="top"
        content={
          <Text color="neutral.c00" whiteSpace="pre-wrap">
            Arguments:{"\n"}
            {JSON.stringify(args, bufferStringifyReplacer, 2)}
          </Text>
        }
      >
        <TooltipTitle fontWeight={isLatest ? "medium" : "regular"}>
          (execution ID: {id}) {date.toLocaleTimeString()}{" "}
          {isError ? "Error" : ""}
        </TooltipTitle>
      </Tooltip>
      {showCustomOutput ? (
        <Flex flexDirection="column" mt={2} width="100%">
          <Text variant="small" color="success.c80" mb={2}>
            Status: Completed
          </Text>
          <OutputComponent
            output={
              (props as { deviceActionState: { output: Output } })
                .deviceActionState.output
            }
            deviceModelId={deviceModelId!}
          />
        </Flex>
      ) : (
        <Text
          variant="body"
          fontWeight="regular"
          color={
            deviceActionStatusToColor[
              isError
                ? DeviceActionStatus.Error
                : props.deviceActionState.status
            ]
          }
          style={{
            fontStyle: "normal",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {isError
            ? inspect(props.error, { depth: null })
            : props.deviceActionState.status === DeviceActionStatus.Error
              ? inspect(props.deviceActionState.error, { depth: null })
              : JSON.stringify(
                  props.deviceActionState,
                  bufferStringifyReplacer,
                  2,
                )}
        </Text>
      )}
      {!isError &&
      props.deviceActionState.status === DeviceActionStatus.Pending ? (
        props.deviceActionState.intermediateValue?.requiredUserInteraction !==
        UserInteractionRequired.None ? (
          <Flex flexDirection="row" alignItems="center" mt={4} columnGap={2}>
            <Icons.Information color="neutral.c100" size="S" />
            <Text>User action required: </Text>
            <Tag active type="opacity">
              {
                props.deviceActionState.intermediateValue
                  .requiredUserInteraction
              }
            </Tag>
          </Flex>
        ) : null
      ) : null}
    </Flex>
  );
}

export const DeviceActionResponse = React.memo(
  DeviceActionResponseInternal,
) as typeof DeviceActionResponseInternal;
