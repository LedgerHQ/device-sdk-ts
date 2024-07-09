import {
  type DeviceActionState,
  DeviceActionStatus,
} from "@ledgerhq/device-sdk-core";
import { FieldType } from "@/hooks/useForm";
import React from "react";
import { Flex, Icons, Tag, Text, Tooltip } from "@ledgerhq/react-ui";
import {
  UserInteractionRequired,
  DeviceActionIntermediateValue,
} from "@ledgerhq/device-sdk-core";

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
        <Text
          variant="small"
          color="neutral.c60"
          fontWeight={isLatest ? "medium" : "regular"}
          flexGrow={0}
          mb={2}
        >
          (id: {id}) {date.toLocaleTimeString()} {isError ? "Error" : ""}
        </Text>
      </Tooltip>
      <Text
        variant="body"
        fontWeight="regular"
        color={
          isError || props.deviceActionState.status === DeviceActionStatus.Error
            ? "error.c80"
            : props.deviceActionState.status === DeviceActionStatus.Pending
              ? "primary.c90"
              : props.deviceActionState.status === DeviceActionStatus.Stopped
                ? "warning.c80"
                : props.deviceActionState.status ===
                    DeviceActionStatus.Completed
                  ? "success.c80"
                  : "neutral.c100"
        }
        style={{
          fontStyle: "normal",
          whiteSpace: "pre-wrap",
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
