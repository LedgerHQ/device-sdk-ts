import React from "react";
import { Flex, InfiniteLoader, Text, Tooltip } from "@ledgerhq/react-ui";
import { FieldType } from "@/hooks/useForm";
import {
  CommandResult,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";

export type CommandResponseProps<Response, ErrorCodes> = {
  args: Record<string, FieldType>;
  date: Date;
  loading: boolean;
  response: CommandResult<Response, ErrorCodes> | null;
};

export function CommandResponse<Response, ErrorCodes>(
  props: CommandResponseProps<Response, ErrorCodes> & { isLatest: boolean },
) {
  const { args, date, loading, response, isLatest } = props;
  const responseString = JSON.stringify(response, null, 2);
  const isError = response !== null && !isSuccessCommandResult(response);
  return (
    <Flex flexDirection="column" alignItems="flex-start">
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
        >
          {date.toLocaleTimeString()}
        </Text>
      </Tooltip>
      {loading ? (
        <InfiniteLoader size={20} />
      ) : (
        <Text
          variant="body"
          fontWeight="regular"
          color={
            isError
              ? "error.c80"
              : responseString
                ? "neutral.c100"
                : "neutral.c80"
          }
          style={{
            fontStyle: responseString ? "normal" : "italic",
            whiteSpace: "pre-wrap",
          }}
        >
          {responseString ?? "void"}
        </Text>
      )}
    </Flex>
  );
}
