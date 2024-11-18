import React from "react";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Flex, Icons, Tag, Text, Tooltip } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { type FieldType } from "@/hooks/useForm";

export type DeviceActionResponseProps<Output, Error, IntermediateValue> = {
  args: Record<string, FieldType>;
  date: Date;
  id: number;
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

/**
 * Component to display an event emitted by a device action.
 */
export function DeviceActionResponse<
  Output,
  Error,
  IntermediateValue extends DeviceActionIntermediateValue,
>(
  props: DeviceActionResponseProps<Output, Error, IntermediateValue> & {
    isLatest: boolean;
  },
) {
  const { args, date, isLatest, id } = props;

  const isError = "error" in props;

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
            {JSON.stringify(args, null, 2)}
          </Text>
        }
      >
        <TooltipTitle fontWeight={isLatest ? "medium" : "regular"}>
          (execution ID: {id}) {date.toLocaleTimeString()}{" "}
          {isError ? "Error" : ""}
        </TooltipTitle>
      </Tooltip>
      <Text
        variant="body"
        fontWeight="regular"
        color={
          deviceActionStatusToColor[
            isError ? DeviceActionStatus.Error : props.deviceActionState.status
          ]
        }
        style={{
          fontStyle: "normal",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(
          isError ? props.error : props.deviceActionState,
          null,
          2,
        )}
      </Text>
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
